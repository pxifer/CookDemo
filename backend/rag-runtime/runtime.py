"""Local-only, frozen-model CPU embeddings; never calls a hosted inference API."""
from __future__ import annotations
import argparse
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import platform
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODELS = ROOT / '.local-data' / 'rag' / 'models'
MODELS = {'qwen': 'Qwen/Qwen3-Embedding-0.6B', 'bge': 'BAAI/bge-m3'}
QUERY_TASK = ('Given a Chinese dietary evidence question, retrieve passages that provide '
              'relevant evidence including applicable conditions and exceptions.')
REPRESENTATION = 'health-evidence-retrieval-text-v1'

def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True)

def get_lock(model, models_dir):
    folder = models_dir / model
    lock = json.loads((folder / 'model-lock.json').read_text(encoding='utf-8'))
    if lock.get('modelId') != MODELS[model] or not isinstance(lock.get('revision'), str) or not re.fullmatch(r'[a-f0-9]{40}', lock['revision']):
        raise ValueError('EMBEDDING_MODEL_LOCK_INVALID')
    snapshot = folder / 'snapshots' / lock['revision']
    if not snapshot.is_dir():
        raise ValueError('EMBEDDING_MODEL_NOT_DOWNLOADED')
    return lock, snapshot

def download(model, models_dir):
    from huggingface_hub import HfApi, snapshot_download
    folder = models_dir / model
    folder.mkdir(parents=True, exist_ok=True)
    lock_path = folder / 'model-lock.json'
    if lock_path.exists():
        lock = json.loads(lock_path.read_text(encoding='utf-8'))
        if lock.get('modelId') != MODELS[model]:
            raise ValueError('EMBEDDING_MODEL_LOCK_INVALID')
        revision = lock['revision']
    else:
        revision = HfApi(token=False).model_info(MODELS[model], revision='main').sha
        if not isinstance(revision, str) or len(revision) != 40:
            raise ValueError('EMBEDDING_REVISION_INVALID')
        lock = {'modelId': MODELS[model], 'revision': revision, 'publicWeights': True}
        lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    snapshot = folder / 'snapshots' / revision
    snapshot_download(MODELS[model], revision=revision, token=False, local_dir=snapshot,
                      allow_patterns=['*.json', '*.safetensors', 'pytorch_model.bin', '*.txt', '*.model', '*.bpe', 'LICENSE*'],
                      ignore_patterns=['onnx/*', 'openvino/*'], max_workers=2)
    hashes = {}
    for file in sorted(snapshot.rglob('*')):
        if file.is_file() and '.cache' not in file.relative_to(snapshot).parts:
            digest = hashlib.sha256()
            with file.open('rb') as stream:
                for part in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(part)
            hashes[file.relative_to(snapshot).as_posix()] = digest.hexdigest()
    if not any(name.endswith('.safetensors') or name == 'pytorch_model.bin' for name in hashes):
        raise ValueError('EMBEDDING_WEIGHTS_MISSING')
    complete = {**lock, 'files': hashes}
    (folder / 'download-manifest.json').write_text(json.dumps(complete, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(canonical({'state': 'downloaded', 'modelId': MODELS[model], 'revision': revision,
                     'files': len(hashes), 'directory': str(snapshot)}), flush=True)

class Encoder:
    def __init__(self, model, models_dir, max_tokens, threads):
        started = time.perf_counter()
        print(canonical({'state': 'loading-dependencies', 'modelId': MODELS[model]}), flush=True)
        os.environ['HF_HUB_OFFLINE'] = '1'
        os.environ['TRANSFORMERS_OFFLINE'] = '1'
        import torch
        from sentence_transformers import SentenceTransformer
        torch.set_num_threads(threads)
        self.model_name = model
        self.lock, snapshot = get_lock(model, models_dir)
        manifest = json.loads((models_dir / model / 'download-manifest.json').read_text(encoding='utf-8'))
        if manifest.get('revision') != self.lock['revision'] or manifest.get('modelId') != self.lock['modelId']:
            raise ValueError('EMBEDDING_DOWNLOAD_MANIFEST_INVALID')
        print(canonical({'state': 'verifying-weights', 'modelId': MODELS[model], 'revision': self.lock['revision']}), flush=True)
        for name, digest in manifest['files'].items():
            file = (snapshot / name).resolve()
            if not file.is_relative_to(snapshot.resolve()) or not file.is_file():
                raise ValueError('EMBEDDING_MODEL_FILES_INVALID')
            check = hashlib.sha256()
            with file.open('rb') as stream:
                for part in iter(lambda: stream.read(1024 * 1024), b''):
                    check.update(part)
            if check.hexdigest() != digest:
                raise ValueError('EMBEDDING_MODEL_HASH_MISMATCH')
        print(canonical({'state': 'loading-model', 'modelId': MODELS[model]}), flush=True)
        self.model = SentenceTransformer(str(snapshot), device='cpu', trust_remote_code=False, local_files_only=True)
        self.model.float()
        self.max_tokens = min(max_tokens, int(self.model.max_seq_length))
        pooling_file = snapshot / '1_Pooling' / 'config.json'
        pooling = json.loads(pooling_file.read_text(encoding='utf-8'))
        pooling_name = '+'.join(sorted(key.removeprefix('pooling_mode_') for key, value in pooling.items()
                                       if key.startswith('pooling_mode_') and value is True))
        if not pooling_name:
            raise ValueError('EMBEDDING_POOLING_UNKNOWN')
        self.identity = {
            'modelId': MODELS[model], 'revision': self.lock['revision'],
            'dimensions': int(self.model.get_sentence_embedding_dimension()),
            'normalization': 'l2', 'pooling': pooling_name,
            'queryInstruction': f'Instruct: {QUERY_TASK}\nQuery: ' if model == 'qwen' else '',
            'documentInstruction': '', 'representationVersion': REPRESENTATION,
            'runtimeVersion': ';'.join([f'python/{platform.python_version()}'] + [
                f'{package}/{importlib.metadata.version(package)}'
                for package in ['torch', 'transformers', 'sentence-transformers']]),
        }
        if self.identity['dimensions'] != 1024:
            raise ValueError('EMBEDDING_MODEL_DIMENSIONS_UNEXPECTED')
        self.load_ms = round((time.perf_counter() - started) * 1000, 2)
        self.inference_lock = threading.Lock()

    def encode(self, texts, role):
        if role not in {'query', 'document'} or not isinstance(texts, list) or not 1 <= len(texts) <= 16:
            raise ValueError('EMBEDDING_INPUT_INVALID')
        if any(not isinstance(text, str) or not text.strip() or len(text) > 16000 for text in texts):
            raise ValueError('EMBEDDING_INPUT_INVALID')
        prepared = [self.identity['queryInstruction'] + text if role == 'query' else text for text in texts]
        with self.inference_lock:
            token_counts = [len(self.model.tokenizer(text, add_special_tokens=True, truncation=False)['input_ids']) for text in prepared]
            if any(count > self.max_tokens for count in token_counts):
                raise ValueError('EMBEDDING_INPUT_TOO_LONG')
            vectors = self.model.encode(prepared, batch_size=min(4, len(prepared)), prompt='',
                                        normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False).tolist()
        for vector in vectors:
            if len(vector) != self.identity['dimensions'] or any(not math.isfinite(value) for value in vector):
                raise ValueError('EMBEDDING_VECTOR_INVALID')
            if abs(sum(value * value for value in vector) - 1) > 0.002:
                raise ValueError('EMBEDDING_VECTOR_NOT_NORMALIZED')
        return {'identity': self.identity, 'vectors': vectors, 'tokenCounts': token_counts}

def serve(args):
    encoder = Encoder(args.model, args.models_dir, args.max_tokens, args.threads)
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(30)
        def log_message(self, *_):
            pass
        def reply(self, status, body):
            data = canonical(body).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                pass
        def do_GET(self):
            if self.path != '/health':
                return self.reply(404, {'error': 'EMBEDDING_ROUTE_NOT_FOUND'})
            self.reply(200, {'status': 'ready', 'identity': encoder.identity, 'device': 'cpu',
                             'modelLoadMs': encoder.load_ms, 'maxTokens': encoder.max_tokens, 'maxBatch': 16})
        def do_POST(self):
            if self.path != '/embed':
                return self.reply(404, {'error': 'EMBEDDING_ROUTE_NOT_FOUND'})
            try:
                if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json' or self.headers.get('Origin'):
                    return self.reply(415, {'error': 'EMBEDDING_JSON_CLIENT_REQUIRED'})
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 256 * 1024 or self.headers.get('Transfer-Encoding'):
                    return self.reply(413, {'error': 'EMBEDDING_BODY_TOO_LARGE'})
                body = json.loads(self.rfile.read(length).decode('utf-8'))
                if not isinstance(body, dict) or set(body) != {'texts', 'role'}:
                    raise ValueError('EMBEDDING_INPUT_INVALID')
                self.reply(200, encoder.encode(body['texts'], body['role']))
            except (ValueError, UnicodeError, KeyError) as error:
                code = str(error) if str(error).startswith('EMBEDDING_') else 'EMBEDDING_INPUT_INVALID'
                self.reply(413 if code == 'EMBEDDING_INPUT_TOO_LONG' else 400, {'error': code})
            except Exception:
                self.reply(500, {'error': 'EMBEDDING_INFERENCE_FAILED'})
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(canonical({'state': 'ready', 'url': f'http://127.0.0.1:{args.port}',
                     'identity': encoder.identity, 'modelLoadMs': encoder.load_ms}), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

def main():
    os.environ['HF_HOME'] = str(ROOT / '.local-data' / 'rag' / 'hf-cache')
    os.environ['HF_XET_CACHE'] = str(ROOT / '.local-data' / 'rag' / 'hf-cache' / 'xet')
    os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
    os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN'] = '1'
    os.environ['TOKENIZERS_PARALLELISM'] = 'false'
    parser = argparse.ArgumentParser()
    parser.add_argument('task', choices=['download', 'serve'])
    parser.add_argument('--model', choices=MODELS, default='qwen')
    parser.add_argument('--models-dir', type=Path, default=DEFAULT_MODELS)
    parser.add_argument('--port', type=int, default=15199)
    parser.add_argument('--max-tokens', type=int, default=8192)
    parser.add_argument('--threads', type=int, default=6)
    parser.add_argument('--debug', action='store_true', help='Startup traceback for local model files; never use request data')
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535 or not 1 <= args.threads <= 12 or not 32 <= args.max_tokens <= 32768:
        parser.error('Port, threads or token budget out of range')
    if args.task == 'download':
        download(args.model, args.models_dir.resolve())
    else:
        serve(args)

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Public model errors only; do not print environment variables or request bodies.
        code = str(error) if str(error).startswith('EMBEDDING_') else type(error).__name__
        print(canonical({'state': 'failed', 'error': code}), file=sys.stderr, flush=True)
        if '--debug' in sys.argv:
            import traceback
            traceback.print_exc()
        raise SystemExit(1)
