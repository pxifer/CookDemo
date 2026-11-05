import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/rebuild-health-sources.py"
spec = importlib.util.spec_from_file_location("source_rebuild", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SourceRebuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.cache = self.root / "cache"
        self.cache.mkdir()
        self.data = "<main><p>限制不是禁止。钠≤5 mg；例外不能删除。</p><script>广告</script><style>噪声</style></main>".encode()
        (self.cache / "source.html").write_bytes(self.data)
        self.registry = {"schemaVersion": 1, "sources": [{"id": "source-1", "cache": "health", "file": "source.html", "format": "html", "sha256": hashlib.sha256(self.data).hexdigest(), "expectedPages": 1}]}

    def tearDown(self):
        self.temp.cleanup()

    def run_rebuild(self, output="output"):
        with patch("urllib.request.urlopen", side_effect=AssertionError("NO_NETWORK")):
            return module.rebuild(self.registry, {"health": self.cache}, self.root / output)

    def test_independent_outputs_are_identical_without_changing_original(self):
        first, second = self.run_rebuild("a"), self.run_rebuild("b")
        self.assertEqual(first, second)
        for name in ("pages.json", "normalized-pages.json", "manifest.json"):
            self.assertEqual((self.root / "a/source-1" / name).read_bytes(), (self.root / "b/source-1" / name).read_bytes())
        self.assertEqual((self.cache / "source.html").read_bytes(), self.data)
        text = (self.root / "a/source-1/pages.json").read_text(encoding="utf-8")
        self.assertIn("限制不是禁止", text)
        self.assertIn("≤5 mg", text)
        self.assertNotIn("广告", text)
        self.assertNotIn("噪声", text)
        self.assertFalse(json.loads((self.root / "a/source-1/manifest.json").read_text())['quality']['bodyDetection'])

    def test_changed_source_and_missing_files_rejected(self):
        (self.cache / "source.html").write_text("changed")
        result = self.run_rebuild()
        self.assertEqual(result['state'], 'incomplete')
        self.assertEqual(result['results'][0]['reason'], 'SOURCE_HASH_MISMATCH')
        self.assertFalse((self.root / "output/source-1/pages.json").exists())

    def test_output_overlap_and_path_escape_rejected(self):
        with self.assertRaisesRegex(ValueError, 'OVERLAPS'):
            module.rebuild(self.registry, {'health': self.cache}, self.cache / 'out')
        with self.assertRaisesRegex(ValueError, 'ESCAPE'):
            module.below(self.cache, '../private.html')
        self.registry['sources'][0]['id'] = '../escape'
        with self.assertRaisesRegex(ValueError, 'INVALID'):
            self.run_rebuild()

    def test_overwrite_different_derived_text_fails_without_touching_original(self):
        self.run_rebuild()
        target = self.root / 'output/source-1/pages.json'
        target.write_text('do not replace')
        with self.assertRaisesRegex(ValueError, 'OUTPUT_CHANGED'):
            self.run_rebuild()
        self.assertEqual(target.read_text(), 'do not replace')
        self.assertEqual((self.cache / 'source.html').read_bytes(), self.data)

    def test_visual_asset_hash_and_bad_encoding_are_not_guessed(self):
        (self.cache / 'image.jpg').write_bytes(b'not-an-actual-image')
        self.registry['sources'][0]['assets'] = [{'file': 'image.jpg', 'sha256': '0' * 64}]
        self.assertEqual(self.run_rebuild()['results'][0]['reason'], 'VISUAL_ASSET_HASH_MISMATCH')
        with self.assertRaises(UnicodeDecodeError):
            module.html_pages(b'\xff\xfe\x00')

    @unittest.skipUnless(importlib.util.find_spec('pypdf'), 'pinned PDF parser not available in this interpreter')
    def test_real_pdf_extraction_flags_empty_page_without_inventing_ocr(self):
        from pypdf import PdfWriter
        path = self.cache / 'blank.pdf'
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.write(path)
        self.registry['sources'][0].update(file='blank.pdf', format='pdf', sha256=hashlib.sha256(path.read_bytes()).hexdigest())
        result = self.run_rebuild()
        self.assertEqual(result['results'][0]['status'], 'rebuilt_with_review_flags')
        self.assertIn('sparse_page_needs_layout_or_ocr_review', result['results'][0]['reviewFlags'])


if __name__ == '__main__':
    unittest.main()
