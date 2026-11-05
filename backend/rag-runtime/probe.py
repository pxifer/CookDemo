"""Real local-inference smoke: public evidence only; no hosted generation."""
import argparse
import hashlib
import json
from pathlib import Path
import time
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=15199)
parser.add_argument('--output', type=Path)
args = parser.parse_args()
if not 1024 <= args.port <= 65535:
    raise SystemExit('EMBEDDING_PORT_INVALID')
base = f'http://127.0.0.1:{args.port}'
def request(route, body=None):
    started = time.perf_counter()
    query = Request(base + route, data=None if body is None else json.dumps(body, ensure_ascii=False).encode('utf-8'),
                    headers={} if body is None else {'Content-Type': 'application/json'})
    with urlopen(query, timeout=240) as response:
        result = json.load(response)
    return result, round((time.perf_counter()-started)*1000, 2)

health, health_ms = request('/health')
bundle = json.loads((ROOT/'datasets/health/2026-10-28-v2/knowledge-bundle.json').read_text(encoding='utf-8'))
examples = bundle['evidence'][:2]
documents, documents_ms = request('/embed', {'texts':[item['retrievalText'] for item in examples], 'role':'document'})
queries, query_ms = request('/embed', {'texts':['成人高血压日常烹调需要少放食盐吗？'], 'role':'query'})
assert documents['identity'] == queries['identity'] == health['identity']
dimensions = health['identity']['dimensions']
assert dimensions == 1024 and len(documents['vectors']) == 2
for vector in documents['vectors'] + queries['vectors']:
    assert len(vector) == dimensions and abs(sum(value*value for value in vector)-1) < .002
report = {'mode':'real_local_cpu_embeddings','identity':health['identity'],'modelLoadMs':health['modelLoadMs'],
          'healthMs':health_ms,'documentsMs':documents_ms,'queryMs':query_ms,
          'evidenceIds':[item['id'] for item in examples], 'documentTokenCounts':documents['tokenCounts'],
          'queryTokenCounts':queries['tokenCounts'],
          'cosines':[sum(a*b for a,b in zip(vector,queries['vectors'][0])) for vector in documents['vectors']],
          'vectorsHash':hashlib.sha256(json.dumps(documents['vectors']+queries['vectors'],separators=(',',':')).encode()).hexdigest(),
          'note':'Public evidence contract and real CPU inference only; not a held-out retrieval or clinical quality benchmark.'}
if args.output:
    output = args.output.resolve()
    if not output.is_relative_to((ROOT/'artifacts/acceptance').resolve()):
        raise SystemExit('EMBEDDING_PROBE_OUTPUT_REJECTED')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
