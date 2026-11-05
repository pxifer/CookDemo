"""Compare independently rebuilt local source trees; export hashes/status only, never full text."""
from argparse import ArgumentParser
from pathlib import Path
import hashlib
import json
import re


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def verify_pair(first, second, registry, evidence):
    reports = [load(root / 'rebuild-report.json') for root in (first, second)]
    if reports[0] != reports[1] or reports[0]['state'] == 'incomplete':
        raise ValueError('REBUILD_REPORTS_DIFFER_OR_INCOMPLETE')
    expected_registry = sha((json.dumps(registry, ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode())
    if reports[0]['registryHash'] != expected_registry or len(reports[0]['results']) != len(registry['sources']):
        raise ValueError('REBUILD_REGISTRY_MISMATCH')
    sources, normalized = [], {}
    descriptors = {s['id']: s for s in registry['sources']}
    if len(descriptors) != len(registry['sources']) or {row['id'] for row in reports[0]['results']} != set(descriptors):
        raise ValueError('REBUILD_SOURCE_COVERAGE_MISMATCH')
    for row in reports[0]['results']:
        source_id = row['id']
        if source_id not in descriptors or not re.fullmatch(r'[a-z0-9][a-z0-9.-]{0,100}', source_id):
            raise ValueError('UNEXPECTED_REBUILD_SOURCE')
        a, b = first / source_id, second / source_id
        manifest_bytes = (a / 'manifest.json').read_bytes()
        manifest = json.loads(manifest_bytes)
        if manifest['id'] != source_id or sha(manifest_bytes) != row['manifestHash'] or manifest_bytes != (b / 'manifest.json').read_bytes() or manifest['source']['sha256'] != descriptors[source_id]['sha256']:
            raise ValueError('REBUILD_MANIFEST_INTEGRITY')
        if set(manifest['outputs']) != {'pages.json', 'normalized-pages.json'}:
            raise ValueError('UNEXPECTED_REBUILD_OUTPUT')
        for file, expected in manifest['outputs'].items():
            data = (a / file).read_bytes()
            if sha(data) != expected or data != (b / file).read_bytes():
                raise ValueError('REBUILD_OUTPUT_INTEGRITY')
        normalized[source_id] = load(a / 'normalized-pages.json')
        sources.append({'id': source_id, 'sourceHash': manifest['source']['sha256'], 'manifestHash': row['manifestHash'], 'pages': manifest['pages'], 'reviewFlags': manifest['reviewFlags'], 'parser': manifest['parser']})
    checks = []
    for item in evidence:
        locator = item['locator']
        if item['sourceId'] not in normalized:
            state = 'source_not_in_registry'
        elif locator['kind'] in ('pdf_visual', 'html_visual'):
            state = 'original_visual_locator_preserved_requires_visual_review'
        else:
            pages = normalized[item['sourceId']]
            page = pages[(locator.get('pdfPage') or 1) - 1]
            span = re.sub(r'\s+', '', item['originalSpan'])
            at = page.find(span)
            if at < 0:
                state = 'normalized_span_not_found_requires_review'
            elif page[locator.get('start', -1):locator.get('end', -1)] == span:
                state = 'same_normalized_locator'
            else:
                state = 'span_found_new_locator_required_original_not_rewritten'
        checks.append({'evidenceId': item['id'], 'sourceId': item['sourceId'], 'state': state})
    return {'schemaVersion': 1, 'sources': sources, 'sourceCount': len(sources), 'parsedUnits': sum(s['pages'] for s in sources),
            'allOutputBytesIdenticalAcrossRuns': True, 'existingEvidenceChecks': checks,
            'clinicalReview': 'pending', 'factsPublished': 0, 'networkRequests': 0,
            'scope': 'Reproducible source reconstruction only. Changed extraction offsets require a new version; originals and frozen locators untouched. No body/table/OCR or semantic approval claimed.'}


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    for name in ('first', 'second', 'registry', 'bundle', 'goals', 'output'):
        parser.add_argument('--' + name, required=True, type=Path)
    args = parser.parse_args()
    evidence = load(args.bundle)['evidence'] + load(args.goals)['evidence']
    report = verify_pair(args.first, args.second, load(args.registry), evidence)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'sources': report['sourceCount'], 'parsedUnits': report['parsedUnits'], 'allOutputBytesIdenticalAcrossRuns': True, 'evidenceStates': {key: sum(c['state'] == key for c in report['existingEvidenceChecks']) for key in sorted({c['state'] for c in report['existingEvidenceChecks']})}}))
