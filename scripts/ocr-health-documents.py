"""Recognize registered public OCR candidates locally; keep text private and unapproved."""
from argparse import ArgumentParser
from pathlib import Path
from collections import Counter
import importlib.util
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('parsing_cli', ROOT / 'scripts/parse-health-documents.py')
parsing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parsing)
core = parsing.core
PS = Path('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')
BRIDGE = ROOT / 'scripts/invoke-windows-ocr.ps1'


def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def private_directory(path):
    path = path.resolve()
    require(path.is_relative_to(ROOT / '.local-data') and path != ROOT / '.local-data', 'OCR_OUTPUT_MUST_BE_PRIVATE')
    return path


def tile_boxes(width, height, side=3000, overlap=180):
    require(width > 0 and height > 0 and 0 <= overlap < side, 'INVALID_TILE_DIMENSIONS')
    def starts(length):
        values, pos = [], 0
        while pos < length:
            values.append(pos)
            if pos + side >= length:
                break
            pos += side - overlap
        return values
    return [[x, y, min(width, x + side), min(height, y + side)] for y in starts(height) for x in starts(width)]


def source_bbox(word_box, variant, angle):
    if angle not in (None, 0):
        return None  # Preserve raw OCR coordinates; do not invent deskewed source locations.
    crop = variant['cropBoxSource']
    return [round(crop[k % 2] + value / variant['scale'][k % 2], 3) for k, value in enumerate(word_box)]


def compare_ocr(first, second):
    require(first['state'] == second['state'] == 'recognized_requires_review', 'OCR_RESULT_MISSING')
    a, b = core.compact(first['text']), core.compact(second['text'])
    # Cross-render disagreement is a warning; agreement is never professional approval.
    critical = re.compile(r'\d+(?:[.,]\d+)*|不|勿|禁|除外|至少|超过|以下|以上|mg|kg|kcal|mmol|[≤≥<>±μµ%]', re.I)
    return {'exactNormalizedTextAgreement': a == b, 'criticalTokenAgreement': critical.findall(a) == critical.findall(b),
            'emptyBoth': not a and not b, 'confidence': None, 'confidenceReason': 'not_exposed_by_windows_ocr_api',
            'criticalSpans': [{'start': m.start(), 'end': m.end(), 'text': m.group()} for m in critical.finditer(first['text'])],
            'reviewRequired': True, 'semanticApproval': False}


def recognize(args):
    from PIL import Image
    import pdfplumber
    output = private_directory(args.output)
    driver_hash, bridge_hash = core.sha(Path(__file__).read_bytes()), core.sha(BRIDGE.read_bytes())
    require(not output.exists(), 'OCR_RUN_EXISTS_NEW_DIRECTORY_REQUIRED')
    parser_root = private_directory(args.parser_root)
    registry = load(args.registry)
    source_rows = {s['id']: s for s in registry['sources']}
    parsed = load(parser_root / 'report.json')
    require(parsed['state'] == 'research_candidates_not_semantically_approved' and {s['id'] for s in parsed['sources']} == set(source_rows), 'PARSER_INPUT_INCOMPLETE')
    expected_engine = load(args.engine_lock)
    require(expected_engine['confidenceAvailable'] is False and expected_engine['modelFiles'], 'OCR_ENGINE_LOCK_INVALID')
    probe = subprocess.run([str(PS), '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(BRIDGE), '-Probe'], capture_output=True, timeout=90, check=True)
    engine = json.loads(probe.stdout.decode('utf-8-sig'))
    require(engine == expected_engine, 'OCR_ENGINE_LOCK_MISMATCH')
    caches = {'health': args.health_cache.resolve(), 'goals': args.goal_cache.resolve()}
    require(not any(output.is_relative_to(x) or x.is_relative_to(output) for x in caches.values()), 'OCR_OUTPUT_OVERLAPS_ORIGINALS')
    selected = set(args.only.split(',')) if args.only else set(source_rows)
    require(selected and selected.issubset(source_rows), 'UNKNOWN_OCR_SOURCE')
    queue, hashes = [], []
    for row in parsed['sources']:
        sid = row['id']
        require(re.fullmatch(r'[a-z0-9][a-z0-9.-]{0,100}', sid), 'INVALID_SOURCE_ID')
        if sid not in selected:
            continue
        src = source_rows[sid]
        manifest_bytes = (parser_root / sid / 'manifest.json').read_bytes()
        manifest = json.loads(manifest_bytes)
        require(core.sha(manifest_bytes) == row['manifestHash'] and manifest['sourceHash'] == src['sha256'], 'PARSER_MANIFEST_INTEGRITY')
        for name, digest in manifest['outputs'].items():
            require(name in ('structure.json', 'enhanced.json', 'ocr-review-queue.json') and core.sha((parser_root / sid / name).read_bytes()) == digest, 'PARSER_OUTPUT_INTEGRITY')
        path = parsing.source_file(caches[src['cache']], src['file'])
        require(core.sha(path.read_bytes()) == src['sha256'], 'ORIGINAL_SOURCE_HASH')
        hashes.append((path, src['sha256']))
        tasks = load(parser_root / sid / 'ocr-review-queue.json')
        for task in tasks:
            if 'page' in task:
                if args.pages and task['page'] not in {int(n) for n in args.pages.split(',')}:
                    continue
                queue.append({'sourceId': sid, 'kind': 'pdf', 'page': task['page'], 'sourceHash': src['sha256'], 'path': path})
            else:
                require(src.get('assets') and manifest['verifiedAssets'] == src['assets'], 'OCR_IMAGE_ASSETS_NOT_REGISTERED')
                for asset in src['assets']:
                    image = parsing.source_file(caches[src['cache']], asset['file'])
                    require(core.sha(image.read_bytes()) == asset['sha256'], 'OCR_IMAGE_ASSET_HASH')
                    hashes.append((image, asset['sha256']))
                    with Image.open(image) as im:
                        size = im.size
                    for crop in tile_boxes(*size):
                        queue.append({'sourceId': sid, 'kind': 'image', 'assetFile': asset['file'], 'sourceHash': asset['sha256'], 'path': image, 'cropBoxSource': crop})
    require(queue, 'NO_SELECTED_OCR_CANDIDATES')
    output.mkdir(parents=True)
    jobs, items = [], []
    for index, item in enumerate(queue):
        item_id = f'item-{index:03d}'
        language = 'en-US' if item['sourceId'].startswith(('kaneko', 'nci', 'shinoda', 'issn')) else 'zh-Hans-CN'
        variants = []
        for variant, dpi in enumerate((144, 216)):
            job_id = f'{item_id}-r{variant}'
            relative = job_id + '.png'
            if item['kind'] == 'pdf':
                with pdfplumber.open(item['path']) as pdf:
                    page = pdf.pages[item['page'] - 1]
                    page_size = [page.width, page.height]
                    crop = [0, 0, page.width, page.height]
                    image = page.to_image(resolution=dpi).original.convert('RGB')
            else:
                with Image.open(item['path']) as source:
                    page_size = list(source.size)
                    crop = item['cropBoxSource']
                    scale = dpi / 144
                    image = source.convert('RGB').crop(crop).resize((round((crop[2]-crop[0]) * scale), round((crop[3]-crop[1]) * scale)), Image.Resampling.LANCZOS)
            require(max(image.size) <= engine['maxImageDimension'], 'OCR_IMAGE_TOO_LARGE')
            image.save(output / relative)
            image_hash = core.sha((output / relative).read_bytes())
            jobs.append({'id': job_id, 'image': relative, 'imageHash': image_hash, 'language': language})
            variants.append({'jobId': job_id, 'renderDpiOrScale': dpi if item['kind'] == 'pdf' else dpi / 144, 'imageHash': image_hash, 'imageSize': list(image.size), 'sourceSize': page_size,
                             'cropBoxSource': crop, 'scale': [image.width/(crop[2]-crop[0]), image.height/(crop[3]-crop[1])], 'coordinateUnit': 'pdf_points' if item['kind'] == 'pdf' else 'original_image_pixels', 'transform': 'explicit_crop_then_scale_no_rotation'})
            image.close()
        items.append({k: v for k, v in item.items() if k != 'path'} | {'id': item_id, 'variants': variants})
    batch = {'schemaVersion': 1, 'expectedEngineHash': engine['identityHash'], 'jobs': jobs}
    parsing.write_once(output / 'batch.json', batch)
    result = subprocess.run([str(PS), '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(BRIDGE), '-InputManifest', str(output / 'batch.json'), '-Output', str(output / 'ocr-results.json')], capture_output=True, timeout=900)
    require((output / 'ocr-results.json').is_file(), 'OCR_BATCH_FAILED_RECEIPT_NOT_CREATED')
    recognized = load(output / 'ocr-results.json')
    require(recognized['engine'] == engine and len(recognized['results']) == len(jobs), 'OCR_BATCH_COVERAGE')
    results = {row['id']: row for row in recognized['results']}
    require(len(results) == len(jobs) and set(results) == {j['id'] for j in jobs}, 'OCR_RESULT_IDS')
    ledger = [json.loads(line) for line in (output / 'issued-calls.jsonl').read_text(encoding='utf-8').splitlines()]
    require(len(ledger) == recognized['issuedCalls'] and len({x['id'] for x in ledger}) == len(ledger), 'OCR_ISSUED_CALL_ACCOUNTING')
    for item in items:
        pair = [results[v['jobId']] for v in item['variants']]
        item['comparison'] = compare_ocr(*pair) if all(r['state'] == 'recognized_requires_review' for r in pair) else {'state': 'failed_requires_review', 'reviewRequired': True, 'semanticApproval': False}
        for variant, value in zip(item['variants'], pair):
            require(value['imageHash'] == variant['imageHash'], 'OCR_RESULT_IMAGE_IDENTITY')
            if value['state'] == 'recognized_requires_review':
                require([value['width'], value['height']] == variant['imageSize'], 'OCR_RESULT_IMAGE_DIMENSIONS')
                for line in value['lines']:
                    for word in line['words']:
                        b = word['bboxPx']
                        require(len(b) == 4 and all(isinstance(x, (int, float)) for x in b) and 0 <= b[0] <= b[2] <= value['width'] + 1 and 0 <= b[1] <= b[3] <= value['height'] + 1 and word['confidence'] is None, 'OCR_WORD_GEOMETRY')
        item['state'] = 'ocr_candidate_requires_review'
    for path, digest in hashes:
        require(core.sha(path.read_bytes()) == digest, 'ORIGINAL_CHANGED_DURING_OCR')
    require(core.sha(Path(__file__).read_bytes()) == driver_hash and core.sha(BRIDGE.read_bytes()) == bridge_hash, 'OCR_CODE_CHANGED_DURING_RUN')
    private = {'schemaVersion': 1, 'engine': engine, 'parserReportHash': core.sha((parser_root / 'report.json').read_bytes()), 'items': items, 'sourceHashesVerifiedAfterRun': True,
               'bridgeHash': bridge_hash, 'driverHash': driver_hash, 'issuedCalls': recognized['issuedCalls'], 'modelCalls': 0, 'factsPublished': 0, 'indexesChanged': 0,
               'scope': 'Local OCR only, two planned renders, no retry. Coordinates/confidence and critical tokens require review. No source text replaced.'}
    parsing.write_once(output / 'manifest.json', private)
    summary = {k: private[k] for k in ('schemaVersion', 'engine', 'parserReportHash', 'bridgeHash', 'driverHash', 'issuedCalls', 'modelCalls', 'factsPublished', 'indexesChanged', 'scope')}
    summary.update({'items': [{'id': i['id'], 'sourceId': i['sourceId'], **{k: i[k] for k in ('page', 'assetFile') if k in i}, 'sourceHash': i['sourceHash'], 'variants': i['variants'], 'comparison': {k: v for k, v in i['comparison'].items() if k != 'criticalSpans'}, 'state': i['state']} for i in items], 'resultStates': dict(Counter(row['state'] for row in recognized['results'])), 'state': 'failed' if result.returncode else 'ocr_candidates_not_semantically_approved', 'selection': 'full_registered_queue' if not args.only and not args.pages else 'selected_debug_subset', 'independentHumanReview': 'pending'})
    parsing.write_once(args.summary, summary)
    print(json.dumps({'items': len(items), 'issuedCalls': recognized['issuedCalls'], 'state': summary['state']}))
    return 0 if result.returncode == 0 else 2


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    for name in ('parser-root', 'registry', 'engine-lock', 'health-cache', 'goal-cache', 'output', 'summary'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--only')
    parser.add_argument('--pages')
    raise SystemExit(recognize(parser.parse_args()))
