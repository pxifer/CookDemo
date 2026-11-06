from pathlib import Path
import importlib.util
import contextlib
import io
import json
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
core=module('parser',ROOT/'scripts/lib/document-parser.py')
evidence=module('evidence',ROOT/'scripts/build-evidence-candidates.py')
verify=module('verify',ROOT/'scripts/verify-document-parsing.py')
def word(ident,text,x,y,size=16,width=15):
    return {'id':ident,'text':text,'x0':x,'x1':x+width,'top':y,'bottom':y+size,'size':size}

class ResolutionTests(unittest.TestCase):
    def build_html_fixture(self, bodies=1, origin='navigation', corrupt=None):
        raw=('<html><body><nav><a>target?</a></nav><article>'+''.join(f'<p>context {i} target? trailing</p>' for i in range(bodies))+'</article></body></html>').encode()
        doc=core.html_document(raw);enh=core.enhance(doc)
        legacy=evidence.legacy_html_text(raw,'remove_unicode_whitespace_v1')
        start=0 if origin=='navigation' else legacy.rfind('target?')
        if corrupt=='offset':start+=1
        ev={'id':'synthetic:nav','sourceId':'synthetic-nav','sourceHash':core.sha(raw),'originalSpan':'target?','locator':{'kind':'html_normalized_text','normalization':'remove_unicode_whitespace_v1','start':start,'end':start+7}}
        with tempfile.TemporaryDirectory(prefix='rag-resolution-') as directory:
            fixture=Path(directory)
            def write(path,value):
                path.parent.mkdir(parents=True,exist_ok=True)
                data=evidence.parsing.encoded(value);path.write_bytes(data);return core.sha(data)
            parser=fixture/'parser';sid=parser/'synthetic-nav'
            outputs={'structure.json':write(sid/'structure.json',doc),'enhanced.json':write(sid/'enhanced.json',enh)}
            manifest=write(sid/'manifest.json',{'outputs':outputs})
            write(parser/'report.json',{'state':'research_candidates_not_semantically_approved','sources':[{'id':'synthetic-nav','sourceHash':ev['sourceHash'],'manifestHash':manifest}]})
            write(fixture/'datasets/health/2026-10-28-v2/knowledge-bundle.json',{'evidence':[ev]})
            write(fixture/'datasets/health/goal-guidance-2026-11-04-v1/knowledge.json',{'evidence':[]})
            write(fixture/'datasets/health/source-rebuild-registry-v1.json',{'sources':[{'id':'synthetic-nav','cache':'health','file':'public.html'}]})
            cache=fixture/'cache';cache.mkdir();(cache/'public.html').write_bytes(raw+b'changed' if corrupt=='cache' else raw)
            if corrupt=='structure':(sid/'structure.json').write_bytes(b'{}')
            output=fixture/'.local-data/output'
            with patch.object(evidence,'ROOT',fixture),contextlib.redirect_stdout(io.StringIO()):
                evidence.build(SimpleNamespace(parser_root=parser,output=output,summary=fixture/'summary.json',legacy_health_cache=cache))
            result=json.loads((output/'evidence-candidates.json').read_text('utf8'))
            self.assertEqual((result['factsCreated'],result['indexesChanged']),(0,0))
            return result['evidenceCandidates'][0]

    def test_builder_quarantines_old_navigation_with_one_or_multiple_body_matches(self):
        for count in (1,2):
            with self.subTest(body_matches=count):
                candidate=self.build_html_fixture(bodies=count)
                self.assertEqual(candidate['state'],'legacy_navigation_anchor_do_not_index')
                self.assertIsNone(candidate['candidateLocator'])
                self.assertIn('navigation_fragment_is_not_supporting_evidence',candidate['reviewFlags'])
                self.assertTrue(candidate['requiresEvidenceRecuration'])
                self.assertEqual(len(candidate['replacementContextCandidates']),count)
                self.assertFalse(candidate['semanticApproval'])

    def test_builder_keeps_verified_body_origin_as_review_candidate(self):
        candidate=self.build_html_fixture(origin='body')
        self.assertEqual(candidate['state'],'located_candidate_requires_review')
        self.assertIsNotNone(candidate['candidateLocator'])
        self.assertEqual(candidate['reviewFlags'],[])
        self.assertFalse(candidate['semanticApproval'])

    def test_builder_unique_match_still_verifies_legacy_and_structure_integrity(self):
        for corrupt,error in [('cache','LEGACY_SOURCE_HASH_MISMATCH'),('offset','LEGACY_EVIDENCE_OFFSET_MISMATCH'),('structure','EVIDENCE_ROLE_SOURCE_HASH_MISMATCH')]:
            with self.subTest(corrupt=corrupt),self.assertRaisesRegex(ValueError,error):
                self.build_html_fixture(corrupt=corrupt)

    def test_numeric_subscripts_follow_base_letters_without_rewriting_characters(self):
        words=[word('b1','B',10,100),word('n1','1',24.9,107.8,8,4),word('b2','B',60,100),word('n2','2',74.9,107.8,8,4)]
        self.assertEqual(core.compact(core.text_of(words)),'B1B2')
        self.assertEqual([w['id'] for w in core.ordered_words(words)],['b1','n1','b2','n2'])
        body=[word('base','B',10,100),word('normal','1',25,108,16)]
        self.assertEqual(len(core.word_rows(body)),2)

    def test_wrapped_cell_precedes_neighbor_value_and_source_words_all_retained(self):
        words=[word('a','first',5,4,9,30),word('b','part',5,20,9,30),word('c','low',120,4,9,20)]
        table=core.table_record([[0,0,100,40],[100,0,200,40]],[0,0,200,40],words,'ruled_grid')
        self.assertEqual(core.compact(table['text']),'firstpartlow')
        self.assertEqual(table['wordIds'],['a','b','c'])
        self.assertEqual(table['serialization'],'cell_row_column_once')
        block={'id':'table0','text':table['text'],'wordIds':table['wordIds']}
        document={'kind':'pdf','pages':[{'page':1,'words':words,'blocks':[block],'removed':[]}]}
        verify.verify_provenance(document,core.enhance(document))
        block['text']='firstlowpart'
        with self.assertRaisesRegex(ValueError,'PDF_BLOCK_CHARACTERS_CHANGED'):verify.verify_provenance(document,core.enhance(document))

    def test_borderless_columns_require_repeated_empty_bands_not_single_row(self):
        words=[word(f'{row}-{col}',str(col)+'.5',5+col*80,30+row*20,9,35) for row in range(10) for col in range(5)]
        result=core.infer_column_boundaries(words,[0,0,400,250])
        self.assertEqual(len(result['boundaries']),6)
        self.assertTrue(all(b['supportingRows']==10 for b in result['bands']))
        self.assertTrue(result['reviewRequired'])
        self.assertIsNone(core.infer_column_boundaries(words[:5],[0,0,400,250]))

    def test_legacy_offset_and_both_contexts_can_resolve_second_occurrence(self):
        text='alpha '+'a'*60+' target '+'x'*60+'\n'+'beta '+'b'*60+' target '+'y'*60
        legacy='script prefix '+text.replace('\n',' ')
        at=legacy.rfind('target')
        ev={'originalSpan':'target','locator':{'kind':'html_normalized_text','start':at,'end':at+6}}
        enhanced={'text':text,'ranges':[{'sourceId':'all','start':0,'end':len(text),'sourceAtomIds':['a']}]}
        self.assertEqual(evidence.anchor(ev,enhanced)['state'],'ambiguous_do_not_index')
        result=evidence.anchor(ev,enhanced,legacy)
        self.assertEqual(result['candidateLocator']['start'],text.rfind('target'))
        self.assertEqual(result['resolutionProof']['originalMatchingOccurrences'],2)
        self.assertEqual(result['resolutionProof']['verifiedOldStart'],at)

    def test_wrong_old_offset_or_context_never_selects_first_match(self):
        text='prefix one target suffix one; prefix two target suffix two'
        enhanced={'text':text,'ranges':[{'sourceId':'all','start':0,'end':len(text)}]}
        ev={'originalSpan':'target','locator':{'kind':'html_normalized_text','start':0,'end':6}}
        self.assertEqual(evidence.anchor(ev,enhanced,text)['state'],'ambiguous_do_not_index')
        ev['locator']={'kind':'html_normalized_text','start':50,'end':56}
        unrelated='z'*50+'target'+'z'*60
        self.assertEqual(evidence.anchor(ev,enhanced,unrelated)['state'],'ambiguous_do_not_index')

    def test_historical_script_data_only_used_for_exact_old_policy(self):
        raw=b' <html><script>SCRIPT_ONLY</script><p>body evidence</p></html> '
        a=evidence.legacy_html_text(raw,'collapse_whitespace_v1')
        b=evidence.legacy_html_text(raw,'remove_unicode_whitespace_v1')
        self.assertIn('SCRIPT_ONLY',a);self.assertNotIn('SCRIPT_ONLY',b)
        self.assertTrue(a.startswith(' '));self.assertIn('bodyevidence',b)
        with self.assertRaisesRegex(ValueError,'UNSUPPORTED_LEGACY_NORMALIZATION'):evidence.legacy_html_text(raw,'other')

    def test_exact_old_stream_identifies_removed_navigation_not_retained_body_copy(self):
        ev={'originalSpan':'target','locator':{'normalization':'remove_unicode_whitespace_v1','start':0,'end':6}}
        doc={'rawAtoms':[{'id':'nav','rawText':'target','locator':{'domPath':'/nav/a'}},{'id':'body','rawText':'other target','locator':{'domPath':'/article/p'}}],'removed':[{'atomId':'nav','reason':'explicit_navigation_or_hidden'}]}
        proof=evidence.removed_navigation_origin(ev,doc,'targetothertarget')
        self.assertEqual(proof['atoms'][0]['id'],'nav')
        self.assertIsNone(evidence.removed_navigation_origin(ev,doc,'different stream'))
        ev['locator'].update(start=11,end=17)
        self.assertIsNone(evidence.removed_navigation_origin(ev,doc,'targetothertarget'))

if __name__=='__main__':unittest.main()
