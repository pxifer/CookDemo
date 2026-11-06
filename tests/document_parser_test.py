from pathlib import Path
import importlib.util
import json
import copy
import unittest
from unittest.mock import patch
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('document_parser', ROOT / 'scripts/lib/document-parser.py')
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
verifier_spec = importlib.util.spec_from_file_location('document_verifier', ROOT / 'scripts/verify-document-parsing.py')
verifier = importlib.util.module_from_spec(verifier_spec)
verifier_spec.loader.exec_module(verifier)


def word(value, x, y, width=40, ident=None):
    return {'id': ident or value, 'text': value, 'x0': x, 'x1': x + width, 'top': y, 'bottom': y + 9, 'size': 9}


class DocumentParserTests(unittest.TestCase):
    @unittest.skipUnless(importlib.util.find_spec('lxml'), 'lxml layout runtime unavailable')
    def test_html_preserves_paragraphs_units_negation_notes_and_removes_explicit_noise(self):
        cases = json.loads((ROOT / 'datasets/evaluation/document-parsing-cases-v1.json').read_text(encoding='utf-8'))['htmlCases']
        for case in cases:
            with self.subTest(case=case['id']):
                document = core.html_document(case['html'].encode())
                output = core.enhance(document)
                text = core.compact(output['text'])
                for item in case['mustRetain']:
                    self.assertIn(core.compact(item), text)
                for item in case['mustRemove']:
                    self.assertNotIn(core.compact(item), text)
                if case.get('mustFlag'):
                    self.assertIn(case['mustFlag'], document['reviewFlags'])
                self.assertTrue(all(r['end'] <= len(output['text']) and r['sourceAtomIds'] for r in output['ranges']))

    @unittest.skipUnless(importlib.util.find_spec('lxml'), 'lxml layout runtime unavailable')
    def test_html_fallback_and_bad_utf8_not_silently_replaced(self):
        value = core.html_document(b'<div><p>body remains</p></div>')
        self.assertIn('body_candidate_not_identified_full_document_fallback', value['reviewFlags'])
        with self.assertRaises(UnicodeDecodeError):
            core.html_document(b'\xff\xfe')
        value = core.html_document(b'<article><p>Body text.</p><aside class="advertisement">buy now</aside><p style="display:none">hidden promotion</p><p style="visibility:hidden">not for everyone</p></article>')
        text = core.enhance(value)['text']
        self.assertNotIn('buy now', text)
        self.assertNotIn('hidden promotion', text)
        self.assertIn('not for everyone', text)

    def test_margin_page_sequence_even_odd_and_critical_text(self):
        pages = []
        for n in range(1, 9):
            lines = [
                {'id': f'{n}:number', 'text': str(708 + n), 'bbox': [30 if n % 2 else 530, 40, 60 if n % 2 else 560, 50]},
                {'id': f'{n}:issue', 'text': 'Vol. 37, No. 5', 'bbox': [450, 40, 560, 50]},
                {'id': f'{n}:protected', 'text': 'not more than 0.5 mg; exception applies', 'bbox': [20, 755, 570, 765]},
                {'id': f'{n}:body', 'text': '123', 'bbox': [40, 200, 70, 210]},
                {'id': f'{n}:zh-condition', 'text': '不建议自行增加；仅适用于指定人群', 'bbox': [20, 760, 570, 770]}
            ]
            pages.append({'page': n, 'width': 600, 'height': 800, 'lines': lines})
        core.margin_decisions(pages)
        for p in pages:
            self.assertEqual(p['lines'][0]['removeReason'], 'consistent_printed_page_number')
            self.assertEqual(p['lines'][1]['removeReason'], 'repeated_margin_text')
            self.assertIsNone(p['lines'][2]['removeReason'])
            self.assertIsNone(p['lines'][3]['removeReason'])
            self.assertIsNone(p['lines'][4]['removeReason'])

    def test_single_page_numeric_fragment_not_assumed_page_number(self):
        pages = [{'page': 1, 'width': 600, 'height': 800, 'lines': [{'text': '2', 'bbox': [20, 750, 30, 760]}]}]
        core.margin_decisions(pages)
        self.assertIsNone(pages[0]['lines'][0]['removeReason'])

    def test_mixed_font_baselines_preserve_numbers_quotes_and_contiguous_evidence(self):
        # Real failure pattern: Latin digits sit 2.648pt lower than Chinese text.
        words = [word('晚餐各占', 20, 100), word('30%', 61, 102.648, 20), word('，午餐占', 82, 100), word('40%', 123, 102.648, 20), word('。减少高糖、高油、', 144, 100, 100)]
        line = core.text_lines(words, 600)
        self.assertEqual(len(line), 1)
        self.assertEqual(core.compact(line[0]['text']), '晚餐各占30%，午餐占40%。减少高糖、高油、')
        self.assertEqual(set(line[0]['wordIds']), {w['id'] for w in words})

    def test_decorated_page_numbers_need_consistent_sequence(self):
        pages = [{'page': i, 'width': 600, 'height': 800, 'lines': [{'text': f'—{i}—', 'bbox': [280, 760, 320, 770]}]} for i in range(1, 6)]
        core.margin_decisions(pages)
        self.assertTrue(all(p['lines'][0]['removeReason'] == 'consistent_printed_page_number' for p in pages))

    def test_mixed_full_width_table_footnote_then_two_columns_order_and_word_accounting(self):
        words = [word('heading', 20, 40, 550), word('table', 40, 100, 450), word('footnote: do not drop', 20, 200, 550)]
        for n in range(10):
            words += [word('L' + str(n), 30, 240 + n * 16, 250), word('R' + str(n), 310, 240 + n * 16, 250)]
        table = {'id': 'table-block', 'bbox': [20, 80, 570, 150], 'text': 'table', 'wordIds': ['table']}
        lines = core.text_lines([w for w in words if w['id'] != 'table'], 600)
        for i, line in enumerate(lines):
            line.update(id=f'line{i}', removeReason=None)
        blocks, gutter = core.ordered_blocks({'width': 600, 'words': words, 'lines': lines, 'tables': [table]})
        self.assertIsNotNone(gutter)
        ids = [i for block in blocks for i in block['wordIds']]
        self.assertEqual(ids[:3], ['heading', 'table', 'footnote: do not drop'])
        self.assertEqual(ids[3:], [f'L{n}' for n in range(10)] + [f'R{n}' for n in range(10)])
        self.assertEqual(len(ids), len(set(ids)))

    def test_reflow_keeps_hyphens_units_negation_and_source_ids(self):
        blocks = [{'id': 'a', 'role': 'body', 'bbox': [20, 20, 200, 30], 'text': 'not-', 'wordIds': ['a']}, {'id': 'b', 'role': 'body', 'bbox': [20, 34, 200, 44], 'text': 'recommended; preserve 0.5 mg', 'wordIds': ['b']}]
        out = core.reflow_blocks(blocks, None)
        self.assertEqual(out[0]['text'], 'not-recommended; preserve 0.5 mg')
        self.assertEqual(out[0]['sourceBlockIds'], ['a', 'b'])
        self.assertEqual(out[0]['wordIds'], ['a', 'b'])

    @unittest.skipUnless(importlib.util.find_spec('lxml'), 'lxml layout runtime unavailable')
    def test_navigation_heading_removed_but_body_heading_and_critical_note_retained(self):
        doc = core.html_document('<article><nav><h2>On This Page</h2><a>Contents</a><p>不适用于儿童</p></nav><h2>正文标题</h2><p>正文保留</p></article>'.encode())
        text = core.enhance(doc)['text']
        self.assertNotIn('On This Page', text)
        self.assertNotIn('Contents', text)
        self.assertIn('正文标题', text)
        self.assertIn('不适用于儿童', text)

    def test_cjk_font_scaled_gap_and_indented_continuation_without_changing_numbers(self):
        blocks = [{'id': 'a', 'role': 'body', 'size': 15.95, 'bbox': [122, 100, 500, 116], 'text': '减少高糖、高油、', 'wordIds': ['a']}, {'id': 'b', 'role': 'body', 'size': 15.95, 'bbox': [90, 130.05, 500, 146], 'text': '高盐食物，保留30%烹饪方', 'wordIds': ['b']}, {'id': 'c', 'role': 'body', 'size': 15.95, 'bbox': [90, 160.05, 120, 176], 'text': '式。', 'wordIds': ['c']}]
        output = core.reflow_blocks(blocks, None)
        self.assertEqual(len(output), 1)
        self.assertEqual(output[0]['text'], '减少高糖、高油、高盐食物，保留30%烹饪方式。')

    def test_merged_table_cells_keep_geometry_without_approving_headers_or_numbers(self):
        words = [word('header', 10, 2, 80), word('A', 10, 22, 20), word('0.5 mg', 60, 22, 30)]
        table = core.table_record([[0, 0, 100, 20], [0, 20, 50, 40], [50, 20, 100, 40]], [0, 0, 100, 40], words, 'ruled_grid')
        self.assertEqual(table['cells'][0]['columnSpan'], 2)
        self.assertEqual(table['cells'][2]['text'], '0.5 mg')
        self.assertEqual(table['headers'], 'unreviewed')
        self.assertTrue(table['reviewRequired'])

    def test_segmented_horizontal_rules_are_joined_without_filling_missing_cells(self):
        runs = core.horizontal_runs([{'x0': 10, 'x1': 50, 'top': 10, 'bottom': 10}, {'x0': 50, 'x1': 100, 'top': 10, 'bottom': 10}])
        self.assertEqual(runs[0]['junctions'], [10, 50, 100])
        self.assertEqual((runs[0]['x0'], runs[0]['x1']), (10, 100))

    def test_repeated_caption_or_footnote_not_removed_as_margin(self):
        pages = [{'page': i, 'width': 600, 'height': 800, 'lines': [{'text': 'Table 1. Source data', 'bbox': [20, 20, 400, 30]}, {'text': '* original source note', 'bbox': [20, 755, 400, 765]}]} for i in range(1, 6)]
        core.margin_decisions(pages)
        self.assertTrue(all(line['removeReason'] is None for p in pages for line in p['lines']))

    def test_cross_page_continuation_needs_explicit_marker_same_number_and_geometry(self):
        def page(n, caption):
            words = [word('header', 10, 102, 80)]
            table = core.table_record([[0, 100, 50, 120], [50, 100, 100, 120]], [0, 100, 100, 120], words, 'ruled_grid')
            table['id'] = f'p{n}:table0'
            return {'page': n, 'width': 100, 'lines': [{'text': caption, 'bbox': [0, 80, 90, 90]}], 'tables': [table]}
        pages = [page(1, 'Table 1. Test'), page(2, 'Table 1 (continued)')]
        core.table_context(pages)
        self.assertEqual(pages[1]['tables'][0]['continuationCandidate']['previousPage'], 1)
        self.assertFalse(pages[1]['tables'][0]['continuationCandidate']['headerInherited'])
        pages = [page(1, 'Table 1. Test'), page(2, 'Table 2 (continued)')]
        core.table_context(pages)
        self.assertEqual(pages[1]['tables'][0]['continuationCandidate']['state'], 'none')

    def test_sparse_image_page_flags_need_for_ocr_but_no_engine_is_called(self):
        class Page:
            width, height, horizontal_edges = 600, 800, []
            images = [{'x0': 0, 'top': 0, 'x1': 600, 'bottom': 800}]
            def extract_words(self, **kw): return []
            def find_tables(self): return []
            def extract_text(self): return ''
            def close(self): pass
        class PDF:
            pages = [Page()]
            def __enter__(self): return self
            def __exit__(self, *args): pass
        with patch.dict('sys.modules', {'pdfplumber': SimpleNamespace(open=lambda path: PDF())}):
            document = core.pdf_document('fixture-only')
        self.assertIn('sparse_page_needs_ocr_or_blank_page_review', document['pages'][0]['reviewFlags'])
        self.assertEqual(core.enhance(document)['text'], '')

    def test_verifier_rejects_duplicate_word_or_modified_negation_even_with_valid_ids(self):
        block = {'id': 'p1:l0', 'role': 'body', 'bbox': [0, 20, 200, 30], 'text': 'not permitted', 'wordIds': ['not', 'permitted']}
        document = {'kind': 'pdf', 'pages': [{'page': 1, 'words': [word('not', 0, 20, 30), word('permitted', 35, 20)], 'blocks': [block], 'removed': []}]}
        verifier.verify_provenance(document, core.enhance(document))
        bad = copy.deepcopy(document)
        bad['pages'][0]['blocks'][0]['wordIds'].append('not')
        with self.assertRaisesRegex(ValueError, 'PDF_WORD_PARTITION'):
            verifier.verify_provenance(bad, core.enhance(bad))
        bad = copy.deepcopy(document)
        bad['pages'][0]['blocks'][0]['text'] = 'permitted'
        with self.assertRaisesRegex(ValueError, 'PDF_BLOCK_CHARACTERS_CHANGED'):
            verifier.verify_provenance(bad, core.enhance(bad))
        bad_enhanced = core.enhance(document)
        bad_enhanced['ranges'][0]['end'] += 1
        with self.assertRaisesRegex(ValueError, 'ENHANCEMENT_NOT_REPRODUCIBLE'):
            verifier.verify_provenance(document, bad_enhanced)


if __name__ == '__main__':
    unittest.main()
