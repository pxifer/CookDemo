"""Detect ruled scan grids and preserve OCR words in cells; no recognition correction or facts."""
from argparse import ArgumentParser
from pathlib import Path
import importlib.util
import json
import re

ROOT = Path(__file__).resolve().parents[1]
def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec);spec.loader.exec_module(value)
    return value
ocr = module('ocr_cli', ROOT / 'scripts/ocr-health-documents.py')
tables = module('table_review', ROOT / 'scripts/lib/table-review.py')
core = ocr.core


def cluster_positions(values):
    groups = []
    for value in values:
        if groups and value - groups[-1][-1] <= 4:
            groups[-1].append(value)
        else:
            groups.append([value])
    return [round(sum(group) / len(group), 2) for group in groups]


def grid_from_ink(ink):
    import numpy as np
    height, width = ink.shape
    radius = max(2, min(8, round(width * .0035)))
    def spread_axis(values, axis):
        padding = [(0,0), (0,0)];padding[axis] = (radius, radius)
        padded = np.pad(values, padding, mode='constant')
        return np.logical_or.reduce([padded[offset:offset+height, :] if axis == 0 else padded[:, offset:offset+width] for offset in range(2*radius+1)])
    # A scanned straight rule can drift across several pixels; this tolerates that
    # without rotating or replacing OCR text or coordinates.
    horizontal = spread_axis(ink, 0)
    ys = cluster_positions(np.flatnonzero(horizontal.mean(axis=1) >= .60).tolist())
    if len(ys) < 3 or ys[-1] - ys[0] < 50:
        return None
    strip = spread_axis(ink, 1)[int(ys[0]):int(ys[-1]) + 1]
    xs = cluster_positions(np.flatnonzero(strip.mean(axis=0) >= .65).tolist())
    if not 3 <= len(xs) <= 24 or len(ys) > 100 or xs[-1] - xs[0] < width * .35:
        return None
    return {'bbox': [xs[0], ys[0], xs[-1], ys[-1]], 'xs': xs, 'ys': ys,
            'method': 'dark_pixel_ruled_grid_candidate', 'reviewRequired': True}


def build(args):
    import numpy as np
    from PIL import Image
    root = args.ocr_root.resolve()
    output = ocr.private_directory(args.output)
    manifest = ocr.load(root / 'manifest.json')
    batch = ocr.load(root / 'batch.json')
    recognized = ocr.load(root / 'ocr-results.json')
    jobs, results = {j['id']: j for j in batch['jobs']}, {v['id']: v for v in recognized['results']}
    ocr.require(len(jobs) == len(results) and set(jobs) == set(results), 'OCR_INPUT_COVERAGE')
    built, skipped = [], []
    for item in manifest['items']:
        for variant in item['variants']:
            ident = variant['jobId'];value = results[ident];job = jobs[ident]
            if value['state'] != 'recognized_requires_review' or value['textAngle'] not in (None, 0):
                skipped.append({'jobId': ident, 'reason': 'failed_or_nonzero_rotation_requires_review'});continue
            path = (root / job['image']).resolve()
            ocr.require(path.is_relative_to(root) and core.sha(path.read_bytes()) == job['imageHash'] == variant['imageHash'] == value['imageHash'], 'OCR_IMAGE_INTEGRITY')
            with Image.open(path) as image:
                grid = grid_from_ink(np.asarray(image.convert('L')) < 145)
            if grid is None:
                continue
            words = [{'id': ident + ':' + w['id'], 'text': w['text'], 'x0': w['bboxPx'][0], 'top': w['bboxPx'][1], 'x1': w['bboxPx'][2], 'bottom': w['bboxPx'][3], 'size': w['bboxPx'][3]-w['bboxPx'][1]} for line in value['lines'] for w in line['words']]
            boxes = [[a, top, b, bottom] for top, bottom in zip(grid['ys'], grid['ys'][1:]) for a, b in zip(grid['xs'], grid['xs'][1:])]
            source = core.table_record(boxes, grid['bbox'], words, grid['method'])
            source['id'] = ident + ':grid0'
            source['columnGeometry'] = [round(x / value['width'], 4) for x in grid['xs']]
            lines = core.text_lines(words, value['width'])
            before = [line for line in lines if 0 <= grid['bbox'][1]-line['bbox'][3] <= 80]
            source['captionCandidate'] = next((line for line in reversed(before) if re.match(r'^(?:表\s*\d|Table\s+\d)', line['text'], re.I)), None)
            source['nearbyUnitCandidates'] = [line for line in before if tables.UNIT.search(line['text'])]
            source['footnoteCandidates'] = [line for line in lines if 0 <= line['bbox'][1]-grid['bbox'][3] <= 60 and re.match(r'^[*#†‡注]', line['text'])]
            review = tables.build_table(source, item.get('page'), item['sourceId'], item['sourceHash'])
            review['ocrJobId'], review['imageHash'], review['engineHash'] = ident, job['imageHash'], manifest['engine']['identityHash']
            review['sourceTransform'] = variant
            review['bboxSourceCandidate'] = ocr.source_bbox(grid['bbox'], variant, value['textAngle'])
            review['reviewFlags'] += ['ocr_confidence_unavailable', 'all_numbers_and_negations_require_visual_review', 'scan_grid_and_headers_unreviewed']
            built.append(review)
    full = {'schemaVersion': 1, 'policy': 'ocr-table-relationships-v1', 'ocrManifestHash': core.sha((root/'manifest.json').read_bytes()), 'codeHash': core.sha(Path(__file__).read_bytes() + (ROOT/'scripts/lib/table-review.py').read_bytes()),
            'numpyVersion': np.__version__, 'tables': built, 'skipped': skipped, 'factsPublished': 0, 'indexesChanged': 0, 'independentHumanReview': 'pending'}
    digest = ocr.parsing.write_once(output/'ocr-table-review.json', full)
    summary = {k: full[k] for k in ('schemaVersion','policy','ocrManifestHash','codeHash','numpyVersion','skipped','factsPublished','indexesChanged','independentHumanReview')}
    summary.update({'fullPayloadHash': digest, 'renderTableCandidates': len(built), 'renderCellCandidates': sum(len(t['cells']) for t in built),
                    'tables': [{'id':t['id'],'sourceId':t['sourceId'],'page':t['page'],'jobId':t['ocrJobId'],'imageHash':t['imageHash'],'bboxSourceCandidate':t['bboxSourceCandidate'],'coordinateUnit':t['sourceTransform']['coordinateUnit'],'cells':len(t['cells']),'relationships':len(t['relationshipCandidates']),'wordAccounting':t['wordAccounting'],'reviewFlags':t['reviewFlags']} for t in built],
                    'state':'ocr_grid_candidates_not_semantically_approved','scope':'Per-render grid candidates; two renders are not two unique source tables. No OCR corrections or facts published.'})
    ocr.parsing.write_once(args.summary, summary)
    print(json.dumps({k:summary[k] for k in ('renderTableCandidates','renderCellCandidates','state')}))


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    for name in ('ocr-root','output','summary'):
        parser.add_argument('--'+name,type=Path,required=True)
    build(parser.parse_args())
