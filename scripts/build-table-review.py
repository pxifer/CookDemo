"""Build offline per-cell relationship review candidates, without publishing facts."""
from argparse import ArgumentParser
from pathlib import Path
from collections import Counter
import importlib.util
import json
import re

ROOT = Path(__file__).resolve().parents[1]
def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec);spec.loader.exec_module(value)
    return value
parsing = module('parsing', ROOT / 'scripts/parse-health-documents.py')
tables = module('table_review', ROOT / 'scripts/lib/table-review.py')
core = parsing.core


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def build(args):
    output = args.output.resolve()
    if not output.is_relative_to(ROOT / '.local-data'):
        raise ValueError('TABLE_FULL_TEXT_MUST_BE_PRIVATE')
    report = load(args.parser_root / 'report.json')
    if report['state'] != 'research_candidates_not_semantically_approved':
        raise ValueError('PARSER_INCOMPLETE')
    result = []
    for row in report['sources']:
        sid = row['id']
        if not re.fullmatch(r'[a-z0-9][a-z0-9.-]{0,100}', sid):
            raise ValueError('SOURCE_ID_INVALID')
        raw = (args.parser_root / sid / 'manifest.json').read_bytes()
        manifest = json.loads(raw)
        data = (args.parser_root / sid / 'structure.json').read_bytes()
        if core.sha(raw) != row['manifestHash'] or core.sha(data) != manifest['outputs']['structure.json']:
            raise ValueError('PARSER_INTEGRITY')
        document = json.loads(data)
        if document['kind'] != 'pdf':
            continue
        for page in document['pages']:
            for table in page['tables']:
                result.append(tables.build_table(table, page['page'], sid, row['sourceHash']))
    tables.link_continuations(result)
    full = {'schemaVersion': 1, 'policy': 'table-relationships-v1', 'parserReportHash': core.sha((args.parser_root / 'report.json').read_bytes()), 'codeHash': core.sha(Path(__file__).read_bytes() + (ROOT / 'scripts/lib/table-review.py').read_bytes()), 'tables': result,
            'reviewOrigin': 'project_agent_engineering_candidates', 'independentHumanReview': 'pending', 'factsPublished': 0, 'indexesChanged': 0}
    digest = parsing.write_once(output / 'table-review.json', full)
    summary = {k: full[k] for k in ('schemaVersion', 'policy', 'parserReportHash', 'codeHash', 'reviewOrigin', 'independentHumanReview', 'factsPublished', 'indexesChanged')}
    summary.update({'fullPayloadHash': digest, 'tableCount': len(result), 'cellCount': sum(len(t['cells']) for t in result), 'relationshipCount': sum(len(t['relationshipCandidates']) for t in result),
                    'flagCounts': dict(Counter(f for t in result for f in t['reviewFlags'])),
                    'tables': [{'id': t['id'], 'sourceId': t['sourceId'], 'sourceHash': t['sourceHash'], 'page': t['page'], 'bbox': t['bbox'], 'cells': len(t['cells']), 'relationships': len(t['relationshipCandidates']), 'wordAccounting': t['wordAccounting'], 'reviewFlags': t['reviewFlags'], 'continuation': t['continuation'], 'state': t['state']} for t in result],
                    'state': 'relationship_candidates_not_semantically_approved'})
    parsing.write_once(args.summary, summary)
    print(json.dumps({k: summary[k] for k in ('tableCount', 'cellCount', 'relationshipCount', 'flagCounts', 'state')}))


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    for name in ('parser-root', 'output', 'summary'):
        parser.add_argument('--' + name, type=Path, required=True)
    build(parser.parse_args())
