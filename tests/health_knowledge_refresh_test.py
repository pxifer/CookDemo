from pathlib import Path
import importlib.util
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('refresh',ROOT/'scripts/build-health-knowledge-v3.py')
refresh=importlib.util.module_from_spec(spec);spec.loader.exec_module(refresh)


class BodyCurationTests(unittest.TestCase):
    def excerpt(self, text):
        doc=refresh.core.html_document(text.encode())
        return refresh.body_excerpt(doc,refresh.core.enhance(doc),'Using a microwave')

    def test_heading_and_navigation_do_not_replace_body(self):
        text,row,atoms=self.excerpt('<html><body><nav>Using a microwave fake navigation</nav><article><h2>Using a microwave fake heading</h2><p>Using a microwave before high heat, with shorter heating.</p></article></body></html>')
        self.assertEqual(text,'Using a microwave before high heat, with shorter heating.')
        self.assertTrue(all('/p' in a['blockKey'] for a in atoms))

    def test_two_body_candidates_are_not_silently_first_match(self):
        with self.assertRaisesRegex(ValueError,'NOT_UNIQUE'):
            self.excerpt('<article><p>Using a microwave first.</p><p>Using a microwave second.</p></article>')

    def test_heading_only_is_not_evidence(self):
        with self.assertRaisesRegex(ValueError,'NOT_UNIQUE'):
            self.excerpt('<article><h2>Using a microwave heading.</h2><p>Different body.</p></article>')

    def test_inline_nodes_keep_the_entire_condition(self):
        text,_,_=self.excerpt('<article><p>Using a microwave <b>prior</b> to high heat <i>only when</i> later contact is shortened.</p></article>')
        self.assertIn('only when later contact is shortened.',text)

    def test_wrong_original_hash_produces_no_bundle(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'.local-data') as folder:
            folder=Path(folder);(folder/'nci-cooked-meats-2017.html').write_text('<article>wrong</article>','utf-8')
            with self.assertRaisesRegex(ValueError,'SOURCE_HASH_MISMATCH'):
                refresh.build(folder,folder/'out')
            self.assertFalse((folder/'out').exists())


if __name__=='__main__':unittest.main()
