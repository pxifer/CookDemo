"""Offline B-line parsing candidates; frozen knowledge, originals and indexes remain unchanged."""
from argparse import ArgumentParser
from importlib.metadata import version
from pathlib import Path
import importlib.util
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
CORE_PATH = ROOT / 'scripts/lib/document-parser.py'
spec = importlib.util.spec_from_file_location('document_parser_core', CORE_PATH)
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode('utf-8')


def write_once(path, value):
    data = encoded(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open('xb') as stream:
            stream.write(data)
    except FileExistsError:
        if path.read_bytes() != data:
            raise ValueError('OUTPUT_CHANGED_NEW_VERSION_REQUIRED')
    return core.sha(data)


def source_file(root, name):
    path = (root / name).resolve()
    if not path.is_relative_to(root.resolve()) or path == root.resolve() or ':' in name or '\\' in name:
        raise ValueError('SOURCE_PATH_ESCAPE')
    return path


def parse_one(source, cache, output, anchors, toolchain):
    path = source_file(cache, source['file'])
    raw = path.read_bytes()
    if core.sha(raw) != source['sha256']:
        raise ValueError('SOURCE_HASH_MISMATCH')
    assets = []
    for asset in source.get('assets', []):
        if core.sha(source_file(cache, asset['file']).read_bytes()) != asset['sha256']:
            raise ValueError('VISUAL_ASSET_HASH_MISMATCH')
        assets.append(asset)
    document = core.html_document(raw) if source['format'] == 'html' else core.pdf_document(path)
    enhanced = core.enhance(document)
    raw_text = ''.join(a['text'] for a in document['rawAtoms']) if document['kind'] == 'html' else ''.join(p['rawText'] for p in document['pages'])
    raw_compact, clean_compact = core.compact(raw_text), core.compact(enhanced['text'])
    checks = []
    for evidence in anchors:
        if evidence['sourceId'] != source['id']:
            continue
        if evidence['locator']['kind'] in ('pdf_visual', 'html_visual'):
            state = 'visual_evidence_requires_image_review'
        else:
            span = core.compact(evidence['originalSpan'])
            state = 'retained' if span in clean_compact else 'cleanup_removed_existing_anchor' if span in raw_compact else 'not_locatable_in_geometry_parse_requires_review'
        checks.append({'evidenceId': evidence['id'], 'state': state})
    if document['kind'] == 'pdf':
        flags = sorted({flag for page in document['pages'] for flag in page['reviewFlags']})
        removed_count = sum(len(p['removed']) for p in document['pages'])
        accounting_failed = any(p['wordAccounting']['missingIds'] or p['wordAccounting']['duplicateIds'] for p in document['pages'])
        tables = sum(len(p['tables']) for p in document['pages'])
        ocr_queue = [{'page': p['page'], 'reason': 'sparse_text_or_image', 'imageRegions': p['images'], 'engine': None, 'state': 'not_run_requires_review'} for p in document['pages'] if any('ocr' in f for f in p['reviewFlags'])]
        units = len(document['pages'])
    else:
        flags, removed_count, accounting_failed, tables, units = document['reviewFlags'], len(document['removed']), False, 0, 1
        ocr_queue = [{'domPath': document['bodyLocator'], 'imageRegions': document['images'], 'engine': None, 'state': 'not_run_requires_review'}] if any('needs_ocr' in f for f in flags) else []
    if core.sha(path.read_bytes()) != source['sha256']:
        raise ValueError('SOURCE_CHANGED_DURING_PARSE')
    target = output / source['id']
    hashes = {'structure.json': write_once(target / 'structure.json', document), 'enhanced.json': write_once(target / 'enhanced.json', enhanced), 'ocr-review-queue.json': write_once(target / 'ocr-review-queue.json', ocr_queue)}
    rejected = accounting_failed or any(check['state'] == 'cleanup_removed_existing_anchor' for check in checks)
    manifest = {'schemaVersion': 1, 'policy': core.POLICY, 'sourceId': source['id'], 'sourceHash': source['sha256'], 'sourceFile': source['file'], 'verifiedAssets': assets, 'toolchain': toolchain, 'outputs': hashes,
                'state': 'rejected_do_not_index' if rejected else 'candidate_requires_engineering_review', 'quality': {'parsedUnits': units, 'removedNoiseBlocks': removed_count, 'tableCandidates': tables, 'ocrQueueItems': len(ocr_queue), 'reviewFlags': flags, 'wordAccountingFailed': accounting_failed, 'existingEvidenceAnchors': checks},
                'publication': {'factsCreated': 0, 'indexesChanged': 0, 'clinicalReview': 'pending', 'ocrPerformed': False, 'tableCellsProfessionallyReviewed': False}}
    manifest_hash = write_once(target / 'manifest.json', manifest)
    return {'id': source['id'], 'manifestHash': manifest_hash, 'sourceHash': source['sha256'], 'state': manifest['state'], 'quality': manifest['quality']}


def main():
    parser = ArgumentParser(description=__doc__)
    for name in ('registry', 'health-cache', 'goal-cache', 'output', 'summary'):
        parser.add_argument('--' + name, required=True, type=Path)
    parser.add_argument('--only', help='Comma-separated declared source IDs; omitted means all cached registered originals')
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(ROOT / '.local-data'):
        raise ValueError('FULL_TEXT_OUTPUT_MUST_BE_LOCAL_DATA')
    roots = {'health': args.health_cache.resolve(), 'goals': args.goal_cache.resolve()}
    if any(output.is_relative_to(root) or root.is_relative_to(output) for root in roots.values()):
        raise ValueError('OUTPUT_OVERLAPS_ORIGINAL_CACHE')
    actual = {name: version(name) for name in core.VERSIONS}
    if actual != core.VERSIONS:
        raise ValueError('DOCUMENT_PARSER_VERSION_MISMATCH')
    toolchain = {'python': sys.version.split()[0], 'dependencies': actual, 'codeHash': core.sha(Path(__file__).read_bytes() + CORE_PATH.read_bytes())}
    registry = json.loads(args.registry.read_text(encoding='utf-8'))
    if registry.get('schemaVersion') != 1 or not isinstance(registry.get('sources'), list):
        raise ValueError('SOURCE_REGISTRY_INVALID')
    if len({s['id'] for s in registry['sources']}) != len(registry['sources']):
        raise ValueError('SOURCE_ID_DUPLICATE')
    wanted = set(args.only.split(',')) if args.only else {s['id'] for s in registry['sources']}
    if not wanted or not wanted.issubset({s['id'] for s in registry['sources']}):
        raise ValueError('UNKNOWN_SELECTED_SOURCE')
    bundle = json.loads((ROOT / 'datasets/health/2026-10-28-v2/knowledge-bundle.json').read_text(encoding='utf-8'))
    goals = json.loads((ROOT / 'datasets/health/goal-guidance-2026-11-04-v1/knowledge.json').read_text(encoding='utf-8'))
    anchors, results = bundle['evidence'] + goals['evidence'], []
    for source in registry['sources']:
        if source['id'] not in wanted:
            continue
        if not re.fullmatch(r'[a-z0-9][a-z0-9.-]{0,100}', source['id']) or source.get('format') not in ('html', 'pdf') or source.get('cache') not in roots:
            raise ValueError('SOURCE_DESCRIPTOR_INVALID')
        try:
            result = parse_one(source, roots[source['cache']], output, anchors, toolchain)
        except Exception as error:
            reason = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[A-Z_]+', str(error)) else type(error).__name__
            result = {'id': source['id'], 'state': 'failed', 'reason': reason}
        results.append(result)
        print(json.dumps({'id': result['id'], 'state': result['state']}, ensure_ascii=False), flush=True)
    report = {'schemaVersion': 1, 'policy': core.POLICY, 'registryHash': core.sha(encoded(registry)), 'toolchain': toolchain, 'sources': results, 'state': 'incomplete' if any(r['state'] in ('failed', 'rejected_do_not_index') for r in results) else 'research_candidates_not_semantically_approved', 'factsPublished': 0, 'modelCalls': 0, 'ocrCalls': 0, 'independentHumanReview': 'pending', 'scope': 'HTML/PDF candidate structure and reversible cleanup. Full texts private. Tables/OCR flags are not complete parsing or clinical approval.'}
    write_once(output / 'report.json', report)
    write_once(args.summary, report)
    return 2 if report['state'] == 'incomplete' else 0


if __name__ == '__main__':
    raise SystemExit(main())
