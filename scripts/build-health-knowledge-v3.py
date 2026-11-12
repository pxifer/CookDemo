"""Curate a small source-checked revision; never overwrite frozen bundles or approve clinical use."""
from argparse import ArgumentParser
from pathlib import Path
from importlib.metadata import version
import copy
import csv
import hashlib
import importlib.util
import io
import json

ROOT = Path(__file__).resolve().parents[1]
VERSION = '2026-11-12-v3'
PARENT = ROOT / 'datasets/health/2026-10-28-v2'
PARSER = ROOT / 'scripts/lib/document-parser.py'
spec = importlib.util.spec_from_file_location('body_parser', PARSER)
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def body_excerpt(document, enhanced, prefix):
    """Select an entire unique paragraph/list block, never a heading/nav substring."""
    atoms = {a['id']: a for a in document['rawAtoms']}
    hits = []
    for row in enhanced['ranges']:
        text = enhanced['text'][row['start']:row['end']]
        source = [atoms[i] for i in row.get('sourceAtomIds', [])]
        if text.startswith(prefix) and source and all(a['inBody'] and a['role'] == 'body' for a in source):
            if not all('/p' in a['blockKey'] or '/li[' in a['blockKey'] for a in source):
                continue
            hits.append((text, row, source))
    if len(hits) != 1:
        raise ValueError('BODY_EXCERPT_NOT_UNIQUE')
    text, row, source = hits[0]
    return text, row, [{'id': a['id'], 'locator': a['locator'], 'blockKey': a['blockKey']} for a in source]


def build(cache, output):
    cache, output = Path(cache).resolve(), Path(output).resolve()
    if output != ROOT / 'datasets/health' / VERSION and not output.is_relative_to(ROOT / '.local-data'):
        raise ValueError('NEW_VERSION_OR_PRIVATE_OUTPUT_REQUIRED')
    parent_bytes = (PARENT / 'knowledge-bundle.json').read_bytes()
    bundle = copy.deepcopy(json.loads(parent_bytes))
    source = next(s for s in bundle['sources'] if s['id'] == 'nci-cooked-meats-2017')
    raw = (cache / 'nci-cooked-meats-2017.html').read_bytes()
    if core.sha(raw) != source['sourceHash']:
        raise ValueError('FROZEN_SOURCE_HASH_MISMATCH')
    toolchain = {name: version(name) for name in core.VERSIONS}
    if toolchain != core.VERSIONS:
        raise ValueError('PINNED_PARSER_DEPENDENCIES_REQUIRED')
    document = core.html_document(raw)
    enhanced = core.enhance(document)
    old = {e['key']: e for e in bundle['evidence'] if e['sourceId'] == source['id']}
    quarantined = json.loads((ROOT / 'datasets/health/evidence-quarantine-v1.json').read_bytes())
    if {r['evidenceId'] for r in quarantined['entries']} != {e['id'] for e in old.values()}:
        raise ValueError('NCI_WITHDRAWAL_SET_MISMATCH')
    # Verify the old navigation error using the actual historical normalization/DOM roles.
    anchor_spec = importlib.util.spec_from_file_location('old_locator', ROOT / 'scripts/build-evidence-candidates.py')
    anchor = importlib.util.module_from_spec(anchor_spec);anchor_spec.loader.exec_module(anchor)
    legacy = anchor.legacy_html_text(raw, old['nci-reduce']['locator']['normalization'])
    origin = anchor.removed_navigation_origin(old['nci-reduce'], document, legacy)
    if origin is None:
        raise ValueError('LEGACY_NAVIGATION_PROOF_REQUIRED')
    selected = [
        ('nci-formation-body-v3', 'HCAs are formed when', 'Formation / complete body paragraph',
         '肌肉肉类的高温反应、滴落烟雾附着及烟熏条件；只说明工艺机制，不推出疾病禁食。'),
        ('nci-human-limits-body-v3', 'Population studies have not established', 'Human evidence / complete limitations',
         '人体暴露与癌症的确定联系尚未建立；暴露估计和个体差异构成限制，不能把形成减少等同治疗或风险下降。'),
        ('nci-no-intake-threshold-body-v3', 'Currently, no Federal guidelines address', 'Consumption guidelines / no HCA PAH intake threshold',
         '该来源没有给出肉中HCA/PAH摄入水平建议，不据工艺关系编造安全量或每餐阈值。'),
        ('nci-microwave-body-v3', 'Using a microwave oven to cook meat prior', 'Reducing formation / microwave before subsequent high heat',
         '微波预熟肉类并缩短完成烹调所需的后续高温接触，可减少HCA形成；不是所有微波操作均有此作用。'),
    ]
    evidence, proof = {}, []
    for key, prefix, section, summary in selected:
        text, row, atoms = body_excerpt(document, enhanced, prefix)
        item = dict(id='ev:' + core.sha((source['sourceHash'] + '\0' + key + '\0' + text).encode()), key=key,
                    sourceId=source['id'], sourceVersion=source['version'], sourceHash=source['sourceHash'],
                    locator=dict(kind='html_cleaned_body', pdfPage=None, printedPage=None, section=section,
                                 start=row['start'], end=row['end'], normalization='document-parsing-v3-enhanced-blocks'),
                    originalSpan=text, spanHash=core.sha(text.encode()), summary=summary,
                    retrievalText=section + '\n' + summary + '\n' + text,
                    chunkerVersion='curated-complete-body-block-v1', verification='project_body_source_rechecked_not_clinical_review', status='active')
        evidence[key] = item
        proof.append(dict(evidenceId=item['id'], key=key, enhancedStart=row['start'], enhancedEnd=row['end'],
                          spanHash=item['spanHash'], atoms=atoms, role='body', extraction='complete_unique_dom_block'))
    old_ids = {e['id'] for e in old.values()}
    bundle['evidence'] = [e for e in bundle['evidence'] if e['id'] not in old_ids] + list(evidence.values())
    qualifiers = [evidence[k]['id'] for k in ['nci-human-limits-body-v3', 'nci-no-intake-threshold-body-v3']]
    affected = []
    for fact in bundle['facts']:
        if not old_ids.intersection(fact['evidenceIds'] + fact['qualifyingEvidenceIds']):
            continue
        old_support = fact['evidenceIds'][:]
        key = 'nci-microwave-body-v3' if fact['id'] == 'fact:microwave-hca' else 'nci-formation-body-v3'
        fact.update(version=VERSION, validFrom='2026-11-12', evidenceIds=[evidence[key]['id']],
                    qualifyingEvidenceIds=qualifiers[:], reviewState='project_body_source_rechecked', clinicalReview='pending')
        if fact['id'] == 'fact:microwave-hca':
            fact['statement'] = '肌肉肉类先经微波预熟，并缩短完成烹调所需的后续高温接触时，可减少HCA形成；不能推成所有微波菜有益或癌症风险已降低。'
            fact['conditions'].append({'key': 'microwavePreheating', 'values': ['yes']})
        affected.append({'factId': fact['id'], 'oldSupportIds': old_support,
                         'supportIds': fact['evidenceIds'], 'qualifyingIds': qualifiers})
    if len(affected) != 4:
        raise ValueError('EXPECTED_FOUR_NCI_FACTS')
    source['license'] = 'NCI text reuse policy: copyright-free unless otherwise indicated; attribute NCI and link to original. No graphics copied. Chinese summaries are project adaptations; NCI does not endorse this translation and no endorsement by NCI should be inferred.'
    bundle.update(schemaVersion='1.1.0', id='health-kb-' + VERSION, createdDate='2026-11-12',
                  revocations=sorted(set(bundle['revocations']) | old_ids))
    parent = {'id': 'health-kb-2026-10-28-v2', 'sha256': core.sha(parent_bytes)}
    bundle['boundaries'].update(parentBundle=parent, sourceRecuration='nci-complete-body-block-v1',
                                professionalReview='pending', unchangedOtherEvidence=95)
    review = dict(id='nci-body-recuration-v1', sourceId=source['id'], sourceHash=source['sourceHash'],
                  parserPolicy=core.POLICY, parserCodeHash=core.sha(PARSER.read_bytes()), dependencies=toolchain,
                  enhancedTextHash=core.sha(enhanced['text'].encode()), bodyLocator=document['bodyLocator'],
                  oldNavigationProof=origin, replacedEvidenceIds=sorted(old_ids), blocks=proof, affectedFacts=affected,
                  reviewOrigin='project_source_recheck', independentClinicalReview=None,
                  scope='Four process facts only; no new disease/food action or nutrition threshold.',
                  livePageCheckedDate='2026-11-12', livePageHashClaimed=False,
                  attributionUrl=source['url'], reusePolicyUrl='https://www.cancer.gov/policies/copyright-reuse')
    files = {'knowledge-bundle.json': encoded(bundle), 'source-recuration.json': encoded(review)}
    for name, field in [('sources', 'sources'), ('entities', 'entities'), ('evidence', 'evidence'), ('facts', 'facts'),
                        ('rule-drafts', 'ruleDrafts'), ('conflicts', 'conflicts')]:
        files[name + '.jsonl'] = ''.join(json.dumps(x, ensure_ascii=False, separators=(',', ':')) + '\n' for x in bundle[field]).encode()
    stream = io.StringIO(newline='');writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(['id','kind','subject_id','predicate','object_id','conditions_json','evidence_ids_json','qualifying_evidence_ids_json','statement','clinical_review'])
    for f in bundle['facts']:
        writer.writerow([f['id'],f['kind'],f['subjectId'],f['predicate'],f['objectId'],json.dumps(f['conditions'],ensure_ascii=False),json.dumps(f['evidenceIds']),json.dumps(f['qualifyingEvidenceIds']),f['statement'],f['clinicalReview']])
    files['relations.csv'] = stream.getvalue().encode('utf-8-sig')
    manifest = dict(id=bundle['id'], schemaVersion=bundle['schemaVersion'], status=bundle['status'], createdDate=bundle['createdDate'],
                    parentBundle=parent, files={name:core.sha(data) for name,data in sorted(files.items())},
                    counts={key:len(bundle[key]) for key in ['sources','entities','evidence','facts','ruleDrafts','conflicts','recipeBindings']},
                    index={'kind':'structured_plus_controlled_keywords','version':'lexical-v3','embedding':None,'reranker':None},
                    clinicalRelease=None, sourceRecuration='source-recuration.json')
    files['manifest.json'] = encoded(manifest)
    for name, data in files.items():
        if (output/name).exists() and (output/name).read_bytes() != data:
            raise ValueError('FROZEN_OUTPUT_DIFFERS_USE_NEW_VERSION')
    output.mkdir(parents=True, exist_ok=True)
    for name, data in files.items():
        if not (output/name).exists():
            with (output/name).open('xb') as stream:
                stream.write(data)
    return manifest


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument('--health-cache', required=True, type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'datasets/health' / VERSION)
    args = parser.parse_args()
    result = build(args.health_cache, args.output)
    print(json.dumps({'id': result['id'], 'counts': result['counts'], 'clinicalRelease': None}, ensure_ascii=False))
