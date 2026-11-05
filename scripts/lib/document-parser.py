"""Conservative document candidates with reversible provenance; no facts or OCR invented."""
from collections import Counter, defaultdict
import hashlib
import re

POLICY = 'document-parsing-v1'
VERSIONS = {'pdfplumber': '0.11.9', 'pdfminer.six': '20251230', 'lxml': '6.1.1', 'Pillow': '13.0.0', 'pypdfium2': '5.14.0', 'cryptography': '50.0.2', 'charset-normalizer': '3.5.2', 'cffi': '2.1.1', 'pycparser': '3.12'}
CRITICAL = re.compile(r'不|勿|忌|避免|限制|禁止|未|无|除外|例外|仅|慎|至少|适用|人群|儿童|妊娠|孕|哺乳|肾功能|低血糖|\b(?:not|no|without|except|unless|avoid|limit|contraindicat\w*)\b|[≤≥<>±μµ%℃]|\d\s*(?:mg|kg|g|ml|kcal|mmol|克|毫克|微克|毫升)', re.I)
NOTE = re.compile(r'footnote|fn-group|ref-list|references|(?:^|[ _-])note(?:$|[ _-])', re.I)
NOISE = re.compile(r'(?:^|[ _-])(?:nav|menu|breadcrumb|share|social|cookie|related|recommendations?|toolbar|ads?|advertisement|advertising)(?:$|[ _-])', re.I)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def compact(text):
    return re.sub(r'\s+', '', text)


def bbox(words):
    return [round(min(w['x0'] for w in words), 3), round(min(w['top'] for w in words), 3), round(max(w['x1'] for w in words), 3), round(max(w['bottom'] for w in words), 3)]


def inside(word, box):
    return box[0] <= (word['x0'] + word['x1']) / 2 < box[2] and box[1] <= (word['top'] + word['bottom']) / 2 < box[3]


def word_rows(words):
    rows = []
    for word in sorted(words, key=lambda w: (w['top'], w['x0'])):
        tolerance = max(3, min(4, word.get('size', 9) * .22))
        match = next((row for row in reversed(rows[-4:]) if abs(row['top'] - word['top']) <= tolerance), None)
        if match is None:
            match = {'top': word['top'], 'words': []}
            rows.append(match)
        match['words'].append(word)
    return sorted(rows, key=lambda row: row['top'])


def text_of(words):
    parts = []
    for word in [w for row in word_rows(words) for w in sorted(row['words'], key=lambda w: w['x0'])]:
        value = word['text']
        if parts and re.search(r'[\u3400-\u9fff]$', parts[-1]) and re.match(r'^[\u3400-\u9fff，。；：、）]', value):
            parts[-1] += value
        else:
            parts.append(value)
    return ' '.join(parts)


def text_lines(words, width):
    result = []
    for row in word_rows(words):
        ordered = sorted(row['words'], key=lambda w: w['x0'])
        segments, current = [], []
        for word in ordered:
            if current and word['x0'] - current[-1]['x1'] > max(10, width * .035):
                segments.append(current)
                current = []
            current.append(word)
        if current:
            segments.append(current)
        for segment in segments:
            result.append({'text': text_of(segment), 'bbox': bbox(segment), 'wordIds': [w['id'] for w in segment], 'size': max(w.get('size', 0) for w in segment)})
    return result


def html_document(data):
    from lxml import html
    data.decode('utf-8-sig', errors='strict')
    root = html.fromstring(data, parser=html.HTMLParser(no_network=True, encoding='utf-8'))
    tree = root.getroottree()
    candidates = []
    for node in root.iter():
        if not isinstance(node.tag, str):
            continue
        ident = (node.get('id', '') + ' ' + node.get('class', '')).lower()
        priority = 4 if node.tag == 'article' else 3 if node.tag == 'main' or node.get('role') == 'main' else 2 if re.search(r'cgvbody|article-body|main-article-body|trs_editor|article.*abstract', ident) else 0
        if priority:
            candidates.append((priority, len(''.join(node.itertext())), node))
    selected = max(candidates, key=lambda item: (item[0], item[1]))[2] if candidates else root
    selected_nodes = set(selected.iter())
    atoms, retained, removed, flags = [], [], [], []
    if not candidates:
        flags.append('body_candidate_not_identified_full_document_fallback')
    def visit(node):
        if not isinstance(node.tag, str):
            return
        if node.text and node.text.strip():
            emit(node, 'text', node.text)
        for child in node:
            visit(child)
            if child.tail and child.tail.strip():
                emit(node, 'tail-after:' + tree.getpath(child), child.tail)
    def emit(node, slot, raw):
        chain = [node, *node.iterancestors()]
        ident = ' '.join(n.get('id', '') + ' ' + n.get('class', '') for n in chain)
        note = bool(NOTE.search(ident))
        paragraph = next((n for n in chain if n.tag in ('p', 'li', 'td', 'th', 'figcaption')), node)
        critical = bool(CRITICAL.search(raw) or CRITICAL.search(''.join(paragraph.itertext())))
        heading = any(n.tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6') for n in chain)
        executable = any(n.tag in ('script', 'style', 'template', 'noscript') for n in chain)
        noisy = any(n.tag in ('nav', 'header', 'footer') or n.get('role') in ('navigation', 'banner', 'contentinfo') or NOISE.search(n.get('id', '') + ' ' + n.get('class', '')) for n in chain)
        hidden = any(n.get('hidden') is not None or n.get('aria-hidden') == 'true' or re.search(r'(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:;|$)', n.get('style', ''), re.I) for n in chain)
        in_body = node in selected_nodes
        keep = not executable and (in_body or note or heading or critical) and not ((noisy or hidden) and not (note or critical or heading))
        text = re.sub(r'\s+', ' ', raw).strip()
        item = {'id': f'html:{len(atoms)}', 'text': text, 'rawText': raw, 'inBody': in_body, 'blockKey': tree.getpath(paragraph), 'locator': {'domPath': tree.getpath(node), 'slot': slot, 'rawHash': sha(raw.encode('utf-8'))}, 'protected': note or critical, 'role': 'footnote_or_reference' if note else 'heading' if heading else 'body'}
        atoms.append(item)
        if keep:
            retained.append(item)
            if noisy or hidden or not in_body:
                flags.append('protected_or_heading_text_retained_outside_body')
        else:
            removed.append({'atomId': item['id'], 'reason': 'executable_or_style' if executable else 'explicit_navigation_or_hidden' if noisy or hidden else 'outside_body_candidate'})
    visit(root)
    images = [{'domPath': tree.getpath(n), 'src': n.get('src'), 'alt': n.get('alt')} for n in selected.iter('img')]
    if len(compact(''.join(a['text'] for a in retained if a['inBody']))) < 40 and images:
        flags.append('image_article_needs_ocr_no_text_invented')
    return {'kind': 'html', 'bodyLocator': tree.getpath(selected), 'rawAtoms': atoms, 'retained': retained, 'removed': removed, 'images': images, 'reviewFlags': sorted(set(flags))}


def horizontal_runs(edges):
    groups = defaultdict(list)
    for edge in edges:
        if abs(edge['bottom'] - edge['top']) < 1.5:
            groups[round(edge['top'])].append((edge['x0'], edge['x1']))
    result = []
    for y, intervals in sorted(groups.items()):
        merged = []
        for left, right in sorted(intervals):
            if merged and left <= merged[-1][1] + 2:
                merged[-1][1] = max(right, merged[-1][1])
            else:
                merged.append([left, right])
        for left, right in merged:
            result.append({'top': y, 'x0': left, 'x1': right, 'junctions': sorted(set(x for pair in intervals for x in pair if left <= x <= right))})
    return result


def pdf_tables(page, words):
    tables = []
    for table in page.find_tables():
        if len(table.rows) < 2 or len(table.rows[0].cells) < 2:
            continue
        boxes = [list(cell) for cell in table.cells]
        tables.append(table_record(boxes, list(table.bbox), words, 'ruled_grid'))
    runs = [r for r in horizontal_runs(page.horizontal_edges) if r['x1'] - r['x0'] > page.width * .7]
    if len(runs) >= 2:
        first, last = runs[0], runs[-1]
        region = [first['x0'], first['top'], first['x1'], last['top']]
        selected = [w for w in words if inside(w, region)]
        if region[3] - region[1] >= 40 and sum(bool(re.search(r'\d', w['text'])) for w in selected) >= 15 and not any(overlap(region, t['bbox']) > .5 for t in tables):
            # Horizontal rules may be segmented at each column even without vertical borders.
            xs = []
            for value in sorted(set(x for r in runs for x in r['junctions'])):
                if not xs or value - xs[-1] > 3:
                    xs.append(value)
            row_lines = text_lines(selected, page.width)
            centers = sorted(set(round((line['bbox'][1] + line['bbox'][3]) / 2, 1) for line in row_lines))
            ys = [region[1]] + [(a + b) / 2 for a, b in zip(centers, centers[1:])] + [region[3]]
            boxes = [[a, top, b, bottom] for top, bottom in zip(ys, ys[1:]) for a, b in zip(xs, xs[1:])] if 2 < len(xs) <= 30 else []
            tables.append(table_record(boxes, region, words, 'horizontal_rules_candidate'))
    return tables


def overlap(a, b):
    area = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
    return area / max(1, min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1])))


def table_record(boxes, region, words, method):
    xs, ys = sorted(set(x for cell in boxes for x in (cell[0], cell[2]))), sorted(set(y for cell in boxes for y in (cell[1], cell[3])))
    cells = []
    for cell in sorted(boxes, key=lambda b: (b[1], b[0])):
        selected = [w for w in words if inside(w, cell)]
        row, col = ys.index(cell[1]), xs.index(cell[0])
        cells.append({'row': row, 'column': col, 'rowSpan': ys.index(cell[3]) - row, 'columnSpan': xs.index(cell[2]) - col, 'bbox': [round(x, 3) for x in cell], 'text': text_of(selected), 'wordIds': [w['id'] for w in selected]})
    selected = [w for w in words if inside(w, region)]
    return {'bbox': [round(x, 3) for x in region], 'method': method, 'cells': cells, 'text': '\n'.join(l['text'] for l in text_lines(selected, region[2] - region[0])), 'wordIds': [w['id'] for w in selected], 'headers': 'unreviewed', 'unitsAndFootnotes': 'retain nearby source blocks; no numeric facts inferred', 'reviewRequired': True}


def detect_gutter(words, width):
    if len(words) < 20:
        return None
    # Consistent empty center gap, not merely a large whitespace between isolated words.
    rows = defaultdict(list)
    for word in words:
        rows[round(word['top'] / 4)].append(word)
    options = []
    for step in range(42, 59):
        x = width * step / 100
        supporting, crossing = 0, 0
        for row in rows.values():
            left = [w for w in row if w['x1'] <= x]
            right = [w for w in row if w['x0'] >= x]
            crossing += any(w['x0'] < x < w['x1'] for w in row)
            if left and right and min(w['x0'] for w in right) - max(w['x1'] for w in left) >= width * .02:
                supporting += 1
        if supporting >= 5 and supporting >= len(rows) * .35 and crossing < len(rows) * .2:
            options.append((supporting - crossing * 2, -abs(step - 50), x))
    return max(options)[2] if options else None


def margin_decisions(pages):
    def printed_number(text):
        match = re.fullmatch(r'[—–-]?\s*(\d{1,5})\s*[—–-]?', text.strip())
        return int(match[1]) if match else None
    repeated, page_numbers = defaultdict(set), defaultdict(set)
    for p in pages:
        for line in p['lines']:
            b, text = line['bbox'], line['text']
            margin = b[3] <= p['height'] * .09 or b[1] >= p['height'] * .91
            issue_header = bool(re.fullmatch(r'Vol\.\s*\d+,?\s*No\.\s*\d+', text, re.I))
            protected_label = bool(re.match(r'^(?:Table\s+\d|续?表\s*\d|[#*†‡])', text, re.I))
            if not margin or line.get('tableId') or protected_label or CRITICAL.search(text) and not issue_header:
                continue
            position = (round(b[0] / p['width'], 1), round(b[1] / p['height'], 2))
            repeated[(compact(text), position)].add(p['page'])
            number = printed_number(text)
            if number is not None:
                page_numbers[(number - p['page'], position)].add(p['page'])
    threshold = max(3, len(pages) * .55)
    for p in pages:
        for line in p['lines']:
            b, text = line['bbox'], line['text']
            margin = b[3] <= p['height'] * .09 or b[1] >= p['height'] * .91
            position = (round(b[0] / p['width'], 1), round(b[1] / p['height'], 2))
            reason = None
            issue_header = bool(re.fullmatch(r'Vol\.\s*\d+,?\s*No\.\s*\d+', text, re.I))
            parity_pages = sum(q['page'] % 2 == p['page'] % 2 for q in pages)
            def frequent(members):
                return len(members) >= threshold or len([n for n in members if n % 2 == p['page'] % 2]) >= max(3, parity_pages * .8)
            protected_label = bool(re.match(r'^(?:Table\s+\d|续?表\s*\d|[#*†‡])', text, re.I))
            if margin and not line.get('tableId') and not protected_label and (not CRITICAL.search(text) or issue_header):
                number = printed_number(text)
                if number is not None and frequent(page_numbers[(number - p['page'], position)]):
                    reason = 'consistent_printed_page_number'
                elif len(compact(text)) < 120 and frequent(repeated[(compact(text), position)]):
                    reason = 'repeated_margin_text'
            line['removeReason'] = reason


def ordered_blocks(page):
    kept = [l for l in page['lines'] if not l['removeReason'] and not l.get('tableId')]
    kept_ids = {word_id for line in kept for word_id in line['wordIds']}
    gutter = detect_gutter([w for w in page['words'] if w['id'] in kept_ids], page['width'])
    if gutter:
        words_by_id = {w['id']: w for w in page['words']}
        split_lines = []
        for line in kept:
            values = [words_by_id[x] for x in line['wordIds']]
            left = [w for w in values if w['x1'] <= gutter]
            right = [w for w in values if w['x0'] >= gutter]
            if left and right and len(left) + len(right) == len(values) and min(w['x0'] for w in right) - max(w['x1'] for w in left) >= page['width'] * .02:
                for label, group in [('left', left), ('right', right)]:
                    split_lines.append(dict(line, id=line['id'] + ':' + label, bbox=bbox(group), text=text_of(group), wordIds=[w['id'] for w in group]))
            else:
                split_lines.append(line)
        kept = split_lines
    # Whole-width tables and spanning headings partition the two-column reading bands.
    barriers = [{'id': t['id'], 'role': 'table_candidate', 'bbox': t['bbox'], 'text': t['text'], 'wordIds': t['wordIds']} for t in page['tables']]
    ordinary = []
    for line in kept:
        block = {'id': line['id'], 'role': 'footnote' if re.match(r'^[#*†‡]', line['text']) else 'heading' if re.match(r'^(?:[一二三四五六七八九十]+[、.]|\d+(?:\.\d+)+\.?\s|附录|Table\s+\d)', line['text']) else 'body', **{k: line[k] for k in ('bbox', 'text', 'wordIds')}}
        if gutter and line['bbox'][0] < gutter < line['bbox'][2]:
            barriers.append(block)
        else:
            ordinary.append(block)
    output, remaining = [], ordinary[:]
    for barrier in sorted(barriers, key=lambda b: (b['bbox'][1], b['bbox'][0])):
        preceding = [b for b in remaining if b['bbox'][3] <= barrier['bbox'][1] + 2]
        remaining = [b for b in remaining if b not in preceding]
        output.extend(order_band(preceding, gutter));output.append(barrier)
    output.extend(order_band(remaining, gutter))
    return reflow_blocks(output, gutter), gutter


def order_band(blocks, gutter):
    if gutter is None:
        return sorted(blocks, key=lambda b: (b['bbox'][1], b['bbox'][0]))
    return sorted(blocks, key=lambda b: (int(b['bbox'][0] >= gutter), b['bbox'][1], b['bbox'][0]))


def table_context(pages):
    previous = []
    for page in pages:
        for table in page['tables']:
            before = [line for line in page['lines'] if 0 <= table['bbox'][1] - line['bbox'][3] <= 45]
            after = [line for line in page['lines'] if 0 <= line['bbox'][1] - table['bbox'][3] <= 35]
            caption = next((line for line in reversed(before) if re.match(r'^(?:Table\s+\d|续?表\s*\d)', line['text'], re.I)), None)
            table['captionCandidate'] = caption
            table['nearbyUnitCandidates'] = [line for line in before if re.search(r'mg|mmol|kcal|μg|µg|g\s*/|克|毫克|毫升', line['text'], re.I)]
            table['footnoteCandidates'] = [line for line in after if CRITICAL.search(line['text']) or re.match(r'^[#*†‡注]', line['text'])]
            table['headerCandidates'] = [cell for cell in table['cells'] if cell['row'] == 0]
            xs = sorted({cell['bbox'][0] for cell in table['cells']} | {cell['bbox'][2] for cell in table['cells']})
            table['columnGeometry'] = [round(x / page['width'], 4) for x in xs]
            table['continuationCandidate'] = {'state': 'none', 'headerInherited': False}
            if caption and re.search(r'continued|cont\.|续', caption['text'], re.I):
                number = re.search(r'(?:Table\s+|续?表\s*)(\d+(?:\.\d+)*)', caption['text'], re.I)
                for old_page, old in previous:
                    old_caption = old.get('captionCandidate')
                    old_number = re.search(r'(?:Table\s+|续?表\s*)(\d+(?:\.\d+)*)', old_caption['text'], re.I) if old_caption else None
                    same_columns = len(old['columnGeometry']) == len(table['columnGeometry']) and all(abs(a - b) < .01 for a, b in zip(old['columnGeometry'], table['columnGeometry']))
                    if old_page == page['page'] - 1 and number and old_number and number[1] == old_number[1] and same_columns:
                        table['continuationCandidate'] = {'state': 'explicit_marker_and_geometry_needs_review', 'previousPage': old_page, 'previousTableId': old['id'], 'headerInherited': False}
            previous.append((page['page'], table))


def reflow_blocks(blocks, gutter):
    output = []
    for block in blocks:
        block = dict(block, sourceBlockIds=[block['id']])
        previous = output[-1] if output else None
        same_column = previous and (gutter is None or (previous['bbox'][0] >= gutter) == (block['bbox'][0] >= gutter))
        if previous and previous['role'] == block['role'] == 'body' and same_column and abs(previous['bbox'][0] - block['bbox'][0]) < 25 and 0 <= block['bbox'][1] - previous['bbox'][3] < 14 and not re.search(r'[。！？.!?;；:：]$', previous['text']) and not re.match(r'^[\d*#†‡（(]', block['text']):
            separator = '' if re.search(r'[\u3400-\u9fff-]$', previous['text']) and re.match(r'^[\u3400-\u9fff]|^[a-z]', block['text']) else ' '
            previous['text'] += separator + block['text']
            previous['wordIds'] += block['wordIds'];previous['sourceBlockIds'] += block['sourceBlockIds']
            previous['bbox'] = [min(previous['bbox'][0], block['bbox'][0]), previous['bbox'][1], max(previous['bbox'][2], block['bbox'][2]), block['bbox'][3]]
            previous['operation'] = 'line_wrap_join_no_character_replacement'
        else:
            output.append(block)
    return output


def pdf_document(path):
    import pdfplumber
    pages = []
    with pdfplumber.open(path) as pdf:
        for index, page in enumerate(pdf.pages):
            raw_words = page.extract_words(extra_attrs=['size'], use_text_flow=False)
            words = [{'id': f'p{index + 1}:w{i}', 'text': w['text'], **{k: round(w[k], 3) for k in ('x0', 'top', 'x1', 'bottom', 'size')}} for i, w in enumerate(raw_words)]
            tables = pdf_tables(page, words)
            for i, table in enumerate(tables):
                table['id'] = f'p{index + 1}:table{i}'
            # Table words are rendered by their atomic table block, never mixed into column order.
            table_word_ids = {word_id for table in tables for word_id in table['wordIds']}
            lines = text_lines([word for word in words if word['id'] not in table_word_ids], page.width)
            for i, line in enumerate(lines):
                line['id'] = f'p{index + 1}:line{i}'
                line['tableId'] = None
            images = [{'bbox': [round(img[k], 3) for k in ('x0', 'top', 'x1', 'bottom')]} for img in page.images]
            pages.append({'page': index + 1, 'width': page.width, 'height': page.height, 'rawText': page.extract_text() or '', 'words': words, 'lines': lines, 'tables': tables, 'images': images})
            page.close()
    margin_decisions(pages)
    table_context(pages)
    for page in pages:
        blocks, gutter = ordered_blocks(page)
        page['blocks'], page['gutter'] = blocks, gutter
        page['removed'] = [{'lineId': line['id'], 'reason': line['removeReason'], 'wordIds': line['wordIds']} for line in page['lines'] if line['removeReason']]
        page['reviewFlags'] = (['two_column_order_candidate'] if gutter else []) + (['table_structure_requires_review'] if page['tables'] else [])
        retained_ids = [word_id for block in blocks for word_id in block['wordIds']]
        removed_ids = [word_id for line in page['removed'] for word_id in line['wordIds']]
        counts = Counter(retained_ids + removed_ids)
        page['wordAccounting'] = {'original': len(page['words']), 'retained': len(retained_ids), 'removedWithReason': len(removed_ids), 'missingIds': [w['id'] for w in page['words'] if not counts[w['id']]], 'duplicateIds': [word_id for word_id, count in counts.items() if count > 1]}
        if page['wordAccounting']['missingIds'] or page['wordAccounting']['duplicateIds']:
            page['reviewFlags'].append('word_accounting_failed_do_not_index')
        if len(compact(page['rawText'])) < 40:
            page['reviewFlags'].append('sparse_page_needs_ocr_or_blank_page_review')
        elif len(compact(page['rawText'])) < 250 and sum(max(0, img['bbox'][2] - img['bbox'][0]) * max(0, img['bbox'][3] - img['bbox'][1]) for img in page['images']) > page['width'] * page['height'] * .45:
            page['reviewFlags'].append('image_dominant_page_needs_ocr_review')
        if any('(cid:' in word['text'] or '\ufffd' in word['text'] for word in page['words']):
            page['reviewFlags'].append('glyph_encoding_requires_review')
    return {'kind': 'pdf', 'pages': pages}


def enhance(document):
    if document['kind'] == 'html':
        blocks = []
        for atom in document['retained']:
            if blocks and blocks[-1]['blockKey'] == atom['blockKey']:
                blocks[-1]['rawText'] += atom['rawText'];blocks[-1]['sourceAtomIds'].append(atom['id'])
            else:
                blocks.append(dict(atom, sourceAtomIds=[atom['id']]))
        for block in blocks:
            block['text'] = re.sub(r'\s+', ' ', block['rawText']).strip()
    else:
        blocks = [dict(block, page=p['page']) for p in document['pages'] for block in p['blocks']]
    text, mappings = '', []
    for block in blocks:
        value = block['text']
        if not value:
            continue
        if text:
            text += '\n'
        start = len(text);text += value
        mappings.append({'start': start, 'end': len(text), 'sourceId': block['id'], **({'page': block['page'], 'sourceWordIds': block['wordIds']} if 'page' in block else {'sourceAtomIds': block['sourceAtomIds']}), 'operation': 'whitespace_and_reading_order_only', 'granularity': 'block_to_original_words_or_dom_text_nodes'})
    return {'text': text, 'ranges': mappings, 'policy': 'No hyphen/number/unit/negation rewriting. Table candidates preserved, not converted to facts.'}
