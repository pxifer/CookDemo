from pathlib import Path
from types import SimpleNamespace
import importlib.util
import unittest
import copy

ROOT=Path(__file__).resolve().parents[1]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
table=module('table',ROOT/'scripts/lib/table-review.py')
ocr=module('ocr',ROOT/'scripts/ocr-health-documents.py')
grid=module('grid',ROOT/'scripts/build-ocr-table-review.py')
evidence=module('evidence',ROOT/'scripts/build-evidence-candidates.py')
audit=module('audit',ROOT/'scripts/audit-document-governance.py')
correction=module('correction',ROOT/'scripts/review-ocr-corrections.py')

def cell(row,col,text,rs=1,cs=1):
    return {'row':row,'column':col,'rowSpan':rs,'columnSpan':cs,'bbox':[col*50,row*20,(col+cs)*50,(row+rs)*20],'text':text,'wordIds':[f'{row}-{col}'] if text else []}

def source(cells):
    return {'id':'p1:t0','method':'ruled_grid','bbox':[0,0,150,100],'cells':cells,'wordIds':[i for c in cells for i in c['wordIds']],
            'columnGeometry':[0,.33,.67,1],'captionCandidate':None,'nearbyUnitCandidates':[],'footnoteCandidates':[],'continuationCandidate':{'state':'none','headerInherited':False}}

class DocumentReviewTests(unittest.TestCase):
    def test_merged_labels_apply_only_to_geometrically_covered_rows(self):
        s=source([cell(0,0,'食物分类'),cell(0,1,'Food name'),cell(0,2,'Class'),cell(1,0,'Group',2),cell(1,1,'A'),cell(1,2,'Low'),cell(2,1,'B'),cell(2,2,'High'),cell(3,0,'Other'),cell(3,1,'C'),cell(3,2,'Mid')])
        t=table.build_table(s,1,'source','a'*64)
        rel=next(x for x in t['relationshipCandidates'] if x['row']==2 and x['column']==2)
        self.assertIn('Group',[x['text'] for x in rel['rowLabelCandidates']])
        rel=next(x for x in t['relationshipCandidates'] if x['row']==3 and x['column']==2)
        self.assertNotIn('Group',[x['text'] for x in rel['rowLabelCandidates']])

    def test_range_units_basis_and_form_remain_source_strings(self):
        s=source([cell(0,0,'食物'),cell(0,1,'每份质量（g）'),cell(0,2,'estimate'),cell(1,0,'dry raw A'),cell(1,1,'23～27'),cell(1,2,'1 unit')])
        s['captionCandidate']={'id':'cap','text':'exchange table 90kcal','bbox':[0,0,50,10]}
        t=table.build_table(s,1,'source','a'*64)
        rel=next(x for x in t['relationshipCandidates'] if x['column']==1)
        self.assertEqual(rel['valueCell']['text'],'23～27')
        self.assertEqual(rel['valueKind'],'number_or_range')
        self.assertIn('dry raw A',[c['text'] for c in rel['rowLabelCandidates']])
        self.assertTrue(any('90kcal' in c['text'] for c in rel['unitAndBasisCandidates']))
        self.assertFalse(rel['approvedFact'])

    def test_multilevel_headers_kept_as_paths_not_flat_guesses(self):
        s=source([cell(0,0,'Food',2),cell(0,1,'Measured',1,2),cell(1,1,'X mg'),cell(1,2,'Y mg'),cell(2,0,'A'),cell(2,1,'1.5'),cell(2,2,'2.0')])
        t=table.build_table(s,1,'source','a'*64)
        self.assertEqual([c['text'] for c in t['columnHeaders'][1]['pathCandidates']],['Measured','X mg'])
        self.assertEqual(t['headerBoundaryCandidate'],2)

    def test_missing_cells_quarantined_without_dropping_source_word_receipt(self):
        s=source([]);s['wordIds']=['original-word']
        t=table.build_table(s,1,'source','a'*64)
        self.assertEqual(t['state'],'rejected_cell_structure_do_not_index')
        self.assertEqual(t['wordAccounting']['missingWordIds'],['original-word'])

    def test_continued_table_requires_same_source_geometry_and_matching_headers(self):
        s=source([cell(0,0,'食物'),cell(0,1,'X'),cell(0,2,'Y'),cell(1,0,'A'),cell(1,1,'1'),cell(1,2,'2')])
        a=table.build_table(s,1,'source','a'*64)
        s2=copy.deepcopy(s);s2['id']='p2:t0';s2['continuationCandidate']={'state':'explicit_marker_and_geometry_needs_review','previousTableId':'p1:t0','headerInherited':False}
        b=table.build_table(s2,2,'source','a'*64);table.link_continuations([a,b])
        self.assertTrue(b['continuation']['verifiedRepeatedHeaders'])
        self.assertFalse(b['continuation']['headerInherited'])
        b['sourceHash']='b'*64;table.link_continuations([a,b])
        self.assertFalse(b['continuation']['verifiedRepeatedHeaders'])

    def test_forged_approved_fact_or_changed_cell_reference_rejected(self):
        t=table.build_table(source([cell(0,0,'食物'),cell(0,1,'Value'),cell(1,0,'A'),cell(1,1,'one')]),1,'source','a'*64)
        audit.validate_candidate_table(t)
        bad=copy.deepcopy(t);bad['relationshipCandidates'][0]['approvedFact']=True
        with self.assertRaisesRegex(ValueError,'UNREVIEWED_RELATION_PUBLISHED'):audit.validate_candidate_table(bad)
        bad=copy.deepcopy(t);bad['relationshipCandidates'][0]['valueCell']=dict(bad['relationshipCandidates'][0]['valueCell'],text='changed')
        with self.assertRaisesRegex(ValueError,'CELL_REFERENCE_CHANGED'):audit.validate_candidate_table(bad)

    def test_shared_ocr_error_agreement_never_bypasses_review(self):
        a={'state':'recognized_requires_review','text':'至少巧0分钟'}
        result=ocr.compare_ocr(a,a)
        self.assertTrue(result['exactNormalizedTextAgreement'])
        self.assertTrue(result['reviewRequired'])
        self.assertFalse(result['semanticApproval'])
        self.assertIsNone(result['confidence'])

    def test_ocr_decimal_disagreement_and_empty_output_not_approved(self):
        result=ocr.compare_ocr({'state':'recognized_requires_review','text':'0.5 mg'},{'state':'recognized_requires_review','text':'5 mg'})
        self.assertFalse(result['criticalTokenAgreement'])
        blank=ocr.compare_ocr({'state':'recognized_requires_review','text':''},{'state':'recognized_requires_review','text':''})
        self.assertTrue(blank['emptyBoth']);self.assertTrue(blank['reviewRequired'])

    def test_long_image_tiles_cover_all_pixels_and_keep_overlap(self):
        boxes=ocr.tile_boxes(700,19802)
        self.assertEqual(boxes[0],[0,0,700,3000]);self.assertEqual(boxes[-1][3],19802)
        self.assertTrue(all(b[1]==a[3]-180 for a,b in zip(boxes,boxes[1:])))
        self.assertTrue(all(b[3]-b[1]<=3000 for b in boxes))
        with self.assertRaises(ValueError):ocr.tile_boxes(1,1,overlap=3000)

    def test_ocr_coordinate_mapping_uses_crop_offset_and_refuses_rotated_guess(self):
        v={'cropBoxSource':[100,2820,800,5820],'scale':[1.5,1.5]}
        self.assertEqual(ocr.source_bbox([15,30,45,60],v,0),[110,2840,130,2860])
        self.assertIsNone(ocr.source_bbox([15,30,45,60],v,1.2))

    @unittest.skipUnless(importlib.util.find_spec('numpy'),'numpy runtime unavailable')
    def test_scanned_grid_geometry_tolerates_rule_drift_without_text_changes(self):
        import numpy as np
        ink=np.zeros((250,400),dtype=bool)
        for y in [30,90,150,210]:
            for x in range(20,381):ink[y+(x//120),x]=True
        for x in [20,160,380]:ink[30:214,x]=True
        found=grid.grid_from_ink(ink)
        self.assertIsNotNone(found)
        self.assertEqual(len(found['xs']),3);self.assertEqual(len(found['ys']),4)
        self.assertIsNone(grid.grid_from_ink(np.zeros((250,400),dtype=bool)))

    def test_unique_anchor_maps_whitespace_to_source_ranges_without_reusing_old_offset(self):
        ev={'originalSpan':'不要改变0.5mg','locator':{'kind':'pdf_normalized_text','pdfPage':2,'start':999}}
        enhanced={'text':'标题\n不要 改变0.5 mg','ranges':[{'page':2,'sourceId':'p2:l0','start':3,'end':14,'sourceWordIds':['w0']}]}
        result=evidence.anchor(ev,enhanced)
        self.assertEqual(result['state'],'located_candidate_requires_review')
        self.assertEqual(result['candidateLocator']['start'],3)
        self.assertEqual(result['candidateLocator']['sourceRanges'][0]['sourceWordIds'],['w0'])

    def test_repeated_anchor_refused_and_declared_page_limits_matching(self):
        enhanced={'text':'same same','ranges':[{'page':1,'sourceId':'a','start':0,'end':4},{'page':2,'sourceId':'b','start':5,'end':9}]}
        ev={'originalSpan':'same','locator':{'kind':'html_normalized_text'}}
        self.assertEqual(evidence.anchor(ev,enhanced)['state'],'ambiguous_do_not_index')
        ev['locator']={'kind':'pdf_normalized_text','pdfPage':2}
        self.assertEqual(evidence.anchor(ev,enhanced)['candidateLocator']['start'],5)

    def test_visual_evidence_keeps_original_review_requirement(self):
        self.assertEqual(evidence.anchor({'locator':{'kind':'pdf_visual'}},{})['state'],'visual_original_requires_review')

    def test_visual_correction_only_changes_separate_view_with_trace(self):
        original={'id':'job-0','imageHash':'a'*64,'state':'recognized_requires_review','text':'巧 0','lines':[{'id':'l0','text':'巧 0','words':[{'id':'w0','text':'巧'},{'id':'w1','text':'0'}]}]}
        proposal={'jobId':'job-0','imageHash':'a'*64,'rawWordIds':['w0','w1'],'rawText':'巧0','suggestedText':'150','origin':'project_agent_visual_proposal','independentHumanReview':False,'state':'proposed_not_applied','visualCropHash':'b'*64}
        before=copy.deepcopy(original);view=correction.correct_result(original,[proposal])
        self.assertEqual(original,before);self.assertEqual(view['correctedText'],'150')
        self.assertFalse(view['semanticApproval']);self.assertFalse(view['independentHumanReview'])
        bad=dict(proposal,rawText='other')
        with self.assertRaisesRegex(ValueError,'CORRECTION_RAW_MISMATCH'):correction.correct_result(original,[bad])

if __name__=='__main__':unittest.main()
