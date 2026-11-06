"""Check paired offline parsing receipts and provenance; export no source full text."""
from argparse import ArgumentParser
from collections import Counter
from pathlib import Path
import importlib.util
import json
import re

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('document_parser', ROOT / 'scripts/lib/document-parser.py')
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def verify_provenance(document, enhanced):
    require(core.enhance(document) == enhanced, 'ENHANCEMENT_NOT_REPRODUCIBLE')
    total, removed, units = 0, 0, 0
    if document['kind'] == 'html':
        atoms = {a['id']: a for a in document['rawAtoms']}
        ids = [a['id'] for a in document['retained']] + [a['atomId'] for a in document['removed']]
        require(len(atoms) == len(document['rawAtoms']) and Counter(ids) == Counter(atoms.keys()), 'HTML_ATOM_PARTITION')
        for atom in document['retained']:
            require(atom == atoms[atom['id']], 'HTML_RETAINED_ATOM_CHANGED')
        for atom in atoms.values():
            require(atom['locator']['rawHash'] == core.sha(atom['rawText'].encode('utf-8')), 'HTML_ATOM_HASH')
        retained = {a['id'] for a in document['retained']}
        mapped = [i for r in enhanced['ranges'] for i in r['sourceAtomIds']]
        require(Counter(mapped) == Counter(retained), 'HTML_RANGE_PROVENANCE')
        total, removed, units = len(atoms), len(document['removed']), 1
    else:
        expected_ranges = []
        for page in document['pages']:
            words = {w['id']: w for w in page['words']}
            kept = [i for b in page['blocks'] for i in b['wordIds']]
            discarded = [i for b in page['removed'] for i in b['wordIds']]
            require(len(words) == len(page['words']) and Counter(kept + discarded) == Counter(words.keys()), 'PDF_WORD_PARTITION')
            require(all(b['reason'] for b in page['removed']), 'PDF_REMOVAL_WITHOUT_REASON')
            for block in page['blocks']:
                require(core.compact(block['text']) == core.compact(''.join(words[i]['text'] for i in block['wordIds'])), 'PDF_BLOCK_CHARACTERS_CHANGED')
                if block['text']:
                    expected_ranges.append((page['page'], block['id'], block['wordIds']))
            total += len(words);removed += len(discarded);units += 1
        require(expected_ranges == [(r['page'], r['sourceId'], r['sourceWordIds']) for r in enhanced['ranges']], 'PDF_RANGE_PROVENANCE')
    last = 0
    for r in enhanced['ranges']:
        require(last <= r['start'] < r['end'] <= len(enhanced['text']), 'INVALID_ENHANCED_RANGE')
        last = r['end']
    return {'originalAtomsOrWords': total, 'removedWithReason': removed, 'parsedUnits': units}


def verify_pair(first, second, registry, cases):
    a, b = (load(root / 'report.json') for root in (first, second))
    require(a == b and a['state'] == 'research_candidates_not_semantically_approved', 'REPORT_DIFFERENT_OR_INCOMPLETE')
    registry_hash = core.sha((json.dumps(registry, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode())
    require(a['registryHash'] == registry_hash and a['policy'] == core.POLICY, 'REGISTRY_OR_POLICY_MISMATCH')
    code_hash = core.sha((ROOT / 'scripts/parse-health-documents.py').read_bytes() + (ROOT / 'scripts/lib/document-parser.py').read_bytes())
    require(a['toolchain']['codeHash'] == code_hash and a['toolchain']['dependencies'] == core.VERSIONS, 'PARSER_TOOLCHAIN_MISMATCH')
    descriptors = {s['id']: s for s in registry['sources']}
    require(len(descriptors) == len(registry['sources']) == len(a['sources']) and {s['id'] for s in a['sources']} == set(descriptors), 'SOURCE_COVERAGE')
    sources, checks = [], []
    for row in a['sources']:
        sid = row['id']
        require(bool(re.fullmatch(r'[a-z0-9][a-z0-9.-]{0,100}', sid)), 'UNSAFE_SOURCE_ID')
        raw = (first / sid / 'manifest.json').read_bytes()
        m = json.loads(raw)
        require(core.sha(raw) == row['manifestHash'] and raw == (second / sid / 'manifest.json').read_bytes(), 'MANIFEST_INTEGRITY')
        require(m['sourceId'] == sid and m['sourceHash'] == row['sourceHash'] == descriptors[sid]['sha256'] and m['verifiedAssets'] == descriptors[sid].get('assets', []), 'SOURCE_OR_ASSET_IDENTITY')
        require(m['state'] == row['state'] == 'candidate_requires_engineering_review' and m['quality'] == row['quality'] and m['toolchain'] == a['toolchain'], 'MANIFEST_REPORT_MISMATCH')
        require(m['publication'] == {'factsCreated': 0, 'indexesChanged': 0, 'clinicalReview': 'pending', 'ocrPerformed': False, 'tableCellsProfessionallyReviewed': False}, 'UNEXPECTED_PUBLICATION')
        require(set(m['outputs']) == {'structure.json', 'enhanced.json', 'ocr-review-queue.json'}, 'UNEXPECTED_OUTPUT')
        for name, expected in m['outputs'].items():
            data = (first / sid / name).read_bytes()
            require(core.sha(data) == expected and data == (second / sid / name).read_bytes(), 'OUTPUT_INTEGRITY')
        document, enhanced = load(first / sid / 'structure.json'), load(first / sid / 'enhanced.json')
        counts = verify_provenance(document, enhanced)
        queue = load(first / sid / 'ocr-review-queue.json')
        require(len(queue) == m['quality']['ocrQueueItems'] and all(q['engine'] is None and q['state'] == 'not_run_requires_review' for q in queue), 'OCR_STATUS_MISMATCH')
        expected_removed = len(document['removed']) if document['kind'] == 'html' else sum(len(p['removed']) for p in document['pages'])
        expected_tables = 0 if document['kind'] == 'html' else sum(len(p['tables']) for p in document['pages'])
        require(m['quality']['removedNoiseBlocks'] == expected_removed and m['quality']['tableCandidates'] == expected_tables and not m['quality']['wordAccountingFailed'], 'QUALITY_COUNTS_MISMATCH')
        require(counts['parsedUnits'] == m['quality']['parsedUnits'] and (descriptors[sid].get('expectedPages') is None or counts['parsedUnits'] == descriptors[sid]['expectedPages']), 'PAGE_COVERAGE')
        checks.extend(dict(c, sourceId=sid) for c in m['quality']['existingEvidenceAnchors'])
        sources.append({'id': sid, 'sourceHash': m['sourceHash'], 'manifestHash': row['manifestHash'], 'counts': counts, 'quality': m['quality']})
    markers = []
    for case in cases['htmlCases']:
        doc = core.html_document(case['html'].encode('utf-8'))
        text = core.compact(core.enhance(doc)['text'])
        positives = sum(core.compact(x) in text for x in case['mustRetain'])
        negatives = sum(core.compact(x) not in text for x in case['mustRemove'])
        require(positives == len(case['mustRetain']) and negatives == len(case['mustRemove']) and (not case.get('mustFlag') or case['mustFlag'] in doc['reviewFlags']), 'ENGINEERING_MARKER_FAILURE')
        markers.append({'id': case['id'], 'positiveMarkers': positives, 'noiseMarkersRemoved': negatives, 'state': 'passed'})
    require(not any(c['state'] == 'cleanup_removed_existing_anchor' for c in checks), 'ANCHOR_LOST_IN_CLEANUP')
    return {'schemaVersion': 1, 'policy': core.POLICY, 'toolchain': a['toolchain'], 'registryHash': registry_hash, 'verifierHash': core.sha(Path(__file__).read_bytes()),
            'sourceCount': len(sources), 'parsedUnits': sum(s['counts']['parsedUnits'] for s in sources), 'allOutputBytesIdenticalAcrossRuns': True,
            'allSourceAtomsOrWordsAccountedExactlyOnce': True, 'allEnhancementRangesVerified': True,
            'totals': {'originalAtomsOrWords': sum(s['counts']['originalAtomsOrWords'] for s in sources), 'removedWithReason': sum(s['counts']['removedWithReason'] for s in sources), **{key: sum(s['quality'][key] for s in sources) for key in ('removedNoiseBlocks', 'tableCandidates', 'ocrQueueItems')}},
            'sources': sources, 'existingEvidenceStates': dict(Counter(c['state'] for c in checks)),
            'engineeringMarkers': {'dataset': cases['id'], 'datasetHash': core.sha((json.dumps(cases, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()), 'split': cases['split'], 'origin': cases['origin'], 'cases': markers, 'independentHumanReview': 'pending'},
            'state': 'engineering_candidates_verified_not_semantically_approved', 'factsPublished': 0, 'indexesChanged': 0, 'modelCalls': 0, 'ocrCalls': 0,
            'limits': ['All 13 real sources exposed during development; no blind acceptance or independent body/table gold.', 'Unlocated existing spans and visual evidence remain review-required; frozen locators not overwritten.', 'Table geometry/units/headers/continuation are candidates only; OCR queue is not recognition.', 'Marker scores are constructed regression only, not corpus-wide retention/noise/clinical accuracy.']}


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    for name in ('first', 'second', 'registry', 'cases', 'output'):
        parser.add_argument('--' + name, required=True, type=Path)
    args = parser.parse_args()
    report = verify_pair(args.first, args.second, load(args.registry), load(args.cases))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ('sourceCount', 'parsedUnits', 'totals', 'existingEvidenceStates', 'state')}))
