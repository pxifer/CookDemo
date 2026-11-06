"""Table relationship candidates. Geometry and source strings are preserved, never facts."""
from collections import Counter
import re

UNIT = re.compile(r'(?<![A-Za-z])(?:mg|g|kg|kcal|mmol|ml|μg|µg)(?![A-Za-z])|\d\s*(?:g|mg|克|毫克)|[％%]|每份|每100|含量|质量', re.I)
LABEL = re.compile(r'foodstuff|food\s*name|\bpart\b|食品名称|食物|主要食品|类别|部位', re.I)
NUMBER = re.compile(r'^[-+]?\d+(?:\.\d+)?(?:\s*[～~–-]\s*\d+(?:\.\d+)?)?$')


def covers(cell, row, column):
    return cell['row'] <= row < cell['row'] + cell['rowSpan'] and cell['column'] <= column < cell['column'] + cell['columnSpan']


def cell_ref(table_id, index, cell):
    return {'cellId': f'{table_id}:cell{index}', **cell}


def build_table(table, page, source_id, source_hash):
    cells = [cell_ref(table['id'], n, c) for n, c in enumerate(table['cells'])]
    columns = max((c['column'] + c['columnSpan'] for c in cells), default=0)
    row_count = max((c['row'] + c['rowSpan'] for c in cells), default=0)
    physical_rows = sorted({c['row'] for c in cells})
    # Numeric-rich first data row is a boundary candidate, not proof of a nutrition table.
    numeric_rows = [row for row in physical_rows if sum(bool(re.search(r'\d', c['text'])) for c in cells if c['row'] == row) >= max(2, columns / 3)]
    first_data = numeric_rows[0] if numeric_rows else 1
    first_data = min(first_data, 4)
    headers = {col: [c for c in cells if c['row'] < first_data and c['column'] <= col < c['column'] + c['columnSpan'] and c['text']] for col in range(columns)}
    label_cols = [col for col, path in headers.items() if any(LABEL.search(c['text']) for c in path)]
    if not label_cols and columns:
        label_cols = [0]
    unit_sources = [{'kind': 'caption', **table['captionCandidate']}] if table.get('captionCandidate') and UNIT.search(table['captionCandidate']['text']) else []
    unit_sources += [{'kind': 'nearby_line', **line} for line in table.get('nearbyUnitCandidates', [])]
    unit_sources += [{'kind': 'header_cell', **c} for c in cells if c['row'] < first_data and UNIT.search(c['text'])]
    entries = []
    for cell in cells:
        if cell['row'] < first_data or cell['column'] in label_cols or not cell['text']:
            continue
        row = cell['row']
        objects = [c for c in cells if c['text'] and any(covers(c, row, col) for col in label_cols)]
        value = cell['text'].strip()
        entries.append({'id': cell['cellId'] + ':relation', 'row': row, 'column': cell['column'], 'valueCell': cell,
                        'valueKind': 'number_or_range' if NUMBER.fullmatch(value) else 'mixed_numeric_text' if re.search(r'\d', value) else 'text_or_category',
                        'rowLabelCandidates': objects, 'columnHeaderPathCandidates': headers[cell['column']],
                        'unitAndBasisCandidates': unit_sources, 'footnoteCandidates': table.get('footnoteCandidates', []),
                        'checksRequired': ['object_and_form', 'column_header_path', 'value_characters', 'unit_and_basis', 'footnote_and_exception', 'applicable_population'],
                        'state': 'relationship_candidate_requires_review', 'approvedFact': False})
    counts = Counter(i for c in cells for i in c['wordIds'])
    words = set(table['wordIds'])
    accounting = {'originalTableWords': len(words), 'missingWordIds': sorted(words - set(counts)), 'duplicateWordIds': sorted(i for i, n in counts.items() if n > 1), 'unknownWordIds': sorted(set(counts) - words)}
    warnings = []
    if any(accounting[k] for k in ('missingWordIds', 'duplicateWordIds', 'unknownWordIds')):
        warnings.append('cell_geometry_word_partition_requires_review')
    if not unit_sources:
        warnings.append('unit_or_basis_not_located_do_not_guess')
    if not first_data:
        warnings.append('header_boundary_unknown')
    if table['method'] != 'ruled_grid':
        warnings.append('inferred_horizontal_grid_not_verified_physical_rows')
    return {'id': f'{source_id}:{table["id"]}', 'sourceId': source_id, 'sourceHash': source_hash, 'page': page,
            'sourceTableId': table['id'], 'bbox': table['bbox'], 'method': table['method'], 'cells': cells,
            'columnGeometry': table.get('columnGeometry', []), 'rowCountCandidate': row_count, 'columnCountCandidate': columns,
            'headerBoundaryCandidate': first_data, 'columnHeaders': [{'column': col, 'pathCandidates': path} for col, path in headers.items()],
            'unitAndBasisCandidates': unit_sources, 'footnoteCandidates': table.get('footnoteCandidates', []),
            'relationshipCandidates': entries, 'wordAccounting': accounting, 'reviewFlags': warnings,
            'continuation': table.get('continuationCandidate', {'state': 'none', 'headerInherited': False}),
            'state': 'rejected_cell_structure_do_not_index' if any(accounting[k] for k in ('missingWordIds', 'duplicateWordIds', 'unknownWordIds')) else 'table_candidate_requires_review', 'semanticApproval': False, 'factsPublished': 0}


def link_continuations(tables):
    by_source_id = {(t['sourceId'], t['sourceTableId']): t for t in tables}
    for table in tables:
        link = table['continuation']
        if link.get('state') != 'explicit_marker_and_geometry_needs_review':
            continue
        old = by_source_id.get((table['sourceId'], link.get('previousTableId')))
        same_geometry = old and table['sourceHash'] == old['sourceHash'] and table['page'] == old['page'] + 1 and old['columnGeometry'] and len(old['columnGeometry']) == len(table['columnGeometry']) and all(abs(a-b) < .01 for a, b in zip(old['columnGeometry'], table['columnGeometry']))
        if not same_geometry:
            table['reviewFlags'].append('continuation_geometry_or_source_mismatch')
            link['verifiedRepeatedHeaders'] = False
            continue
        def paths(value):
            return [[re.sub(r'\s+', '', c['text']) for c in row['pathCandidates']] for row in value['columnHeaders']]
        link['verifiedRepeatedHeaders'] = bool(any(paths(table)) and paths(old) == paths(table))
        link['previousHeaderReferences'] = [c['cellId'] for row in old['columnHeaders'] for c in row['pathCandidates']]
        link['headerInherited'] = False
        link['reviewRequired'] = True
        if not link['verifiedRepeatedHeaders']:
            table['reviewFlags'].append('continued_header_semantics_not_verified_no_inheritance')
