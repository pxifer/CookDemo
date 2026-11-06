"""Verify paired document candidates and export counts/hashes, never full source text."""
from argparse import ArgumentParser
from collections import Counter
from pathlib import Path
from importlib.metadata import version
import importlib.util
import json

ROOT=Path(__file__).resolve().parents[1]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
ocr=module('ocr',ROOT/'scripts/ocr-health-documents.py')
core=ocr.core


def validate_candidate_table(table):
    ocr.require(not table['semanticApproval'] and table['factsPublished']==0,'TABLE_APPROVAL_NOT_ALLOWED')
    cells={c['cellId']:c for c in table['cells']}
    ocr.require(len(cells)==len(table['cells']),'DUPLICATE_CELL_ID')
    for relation in table['relationshipCandidates']:
        ocr.require(relation['approvedFact'] is False and relation['state']=='relationship_candidate_requires_review','UNREVIEWED_RELATION_PUBLISHED')
        for ref in [relation['valueCell'],*relation['rowLabelCandidates'],*relation['columnHeaderPathCandidates']]:
            ocr.require(ref['cellId'] in cells and ref==cells[ref['cellId']],'CELL_REFERENCE_CHANGED')
    return {'persistCandidate':True,'publishFacts':False,'buildVectors':False,'reason':'semantic_review_pending'}


def pair(first,second,name):
    a,b=(root/name for root in (first,second))
    raw=a.read_bytes()
    ocr.require(raw==b.read_bytes(),'PAIRED_OUTPUT_DIFFERS_'+name.replace('.','_').upper())
    return json.loads(raw),core.sha(raw)


def audit(args):
    native,native_hash=pair(args.table_first,args.table_second,'table-review.json')
    scans,scans_hash=pair(args.scan_first,args.scan_second,'ocr-table-review.json')
    evidence,evidence_hash=pair(args.evidence_first,args.evidence_second,'evidence-candidates.json')
    recognized,ocr_hash=pair(args.ocr_first,args.ocr_second,'ocr-results.json')
    manifest,manifest_hash=pair(args.ocr_first,args.ocr_second,'manifest.json')
    batch,batch_hash=pair(args.ocr_first,args.ocr_second,'batch.json')
    ocr.require(native['codeHash']==core.sha((ROOT/'scripts/build-table-review.py').read_bytes()+(ROOT/'scripts/lib/table-review.py').read_bytes()) and scans['codeHash']==core.sha((ROOT/'scripts/build-ocr-table-review.py').read_bytes()+(ROOT/'scripts/lib/table-review.py').read_bytes()) and evidence['codeHash']==core.sha((ROOT/'scripts/build-evidence-candidates.py').read_bytes()),'CANDIDATE_CODE_IDENTITY')
    ocr.require(scans['ocrManifestHash']==manifest_hash and evidence['parserReportHash']==native['parserReportHash']==manifest['parserReportHash'],'CANDIDATE_PARENT_IDENTITY')
    ocr.require(manifest['driverHash']==core.sha((ROOT/'scripts/ocr-health-documents.py').read_bytes()) and manifest['bridgeHash']==core.sha((ROOT/'scripts/invoke-windows-ocr.ps1').read_bytes()),'OCR_CODE_IDENTITY')
    ocr.require(manifest['engine']==ocr.load(ROOT/'datasets/evaluation/ocr-engine-windows-v1.json')==recognized['engine'],'OCR_ENGINE_IDENTITY')
    ocr.require(scans['numpyVersion']==version('numpy')=='2.3.5','GRID_DEPENDENCY_IDENTITY')
    jobs={j['id']:j for j in batch['jobs']};results={r['id']:r for r in recognized['results']}
    ocr.require(len(jobs)==len(batch['jobs'])==len(results)==len(recognized['results']) and set(jobs)==set(results),'OCR_COVERAGE')
    for root in (args.ocr_first,args.ocr_second):
        ledger=[json.loads(x) for x in (root/'issued-calls.jsonl').read_text('utf-8').splitlines()]
        ocr.require(len(ledger)==recognized['issuedCalls'] and [x['call'] for x in ledger]==list(range(1,len(ledger)+1)) and {x['id'] for x in ledger}==set(jobs),'OCR_CALL_LEDGER')
        for job in jobs.values():
            path=(root/job['image']).resolve()
            ocr.require(path.is_relative_to(root.resolve()) and core.sha(path.read_bytes())==job['imageHash'],'RENDER_IMAGE_HASH')
    for result in results.values():
        ocr.require(result['state']=='recognized_requires_review' and result['confidence'] is None and result['imageHash']==jobs[result['id']]['imageHash'],'OCR_RESULT_STATE')
        ocr.require(core.compact(result['text'])==core.compact(''.join(line['text'] for line in result['lines'])),'OCR_TEXT_LINE_CONSERVATION')
        ocr.require(all(w['confidence'] is None for line in result['lines'] for w in line['words']),'FABRICATED_OCR_CONFIDENCE')
    groups={}
    for item in manifest['items']:
        ocr.require(item['comparison']['reviewRequired'] is True and item['comparison']['semanticApproval'] is False,'OCR_REVIEW_BYPASSED')
        if item['kind']=='image':groups.setdefault((item['sourceId'],item['assetFile']),[]).append(item)
        for v in item['variants']:ocr.require(v['jobId'] in jobs and v['imageHash']==jobs[v['jobId']]['imageHash'],'OCR_ITEM_JOB_IDENTITY')
    for items in groups.values():
        width,height=items[0]['variants'][0]['sourceSize']
        ocr.require([x['cropBoxSource'] for x in items]==ocr.tile_boxes(width,height),'IMAGE_TILE_COVERAGE')
    all_tables=native['tables']+scans['tables']
    for t in all_tables:validate_candidate_table(t)
    ocr.require(manifest['factsPublished']==native['factsPublished']==scans['factsPublished']==evidence['factsCreated']==0 and manifest['indexesChanged']==native['indexesChanged']==scans['indexesChanged']==evidence['indexesChanged']==0 and manifest['modelCalls']==0,'PUBLICATION_BOUNDARY')
    for item in evidence['evidenceCandidates']:
        ocr.require(item['semanticApproval'] is False,'EVIDENCE_REVIEW_BYPASSED')
        if item['state']=='located_candidate_requires_review':ocr.require(core.compact(item['cleanedSpan'])==core.compact(item['originalSpan']) and item['matchingOccurrences']==1,'EVIDENCE_SPAN_CHANGED')
    cases=ocr.load(args.cases);by_id={(t['sourceId'],t['sourceTableId']):t for t in native['tables']};checks=[]
    for case in cases['actualCellChecks']:
        table=by_id[case['sourceId'],case['tableId']]
        cell=next(c for c in table['cells'] if c['row']==case['row'] and c['column']==case['column'])
        ok=cell['text']==case['expectedText'] and all(cell[k]==case[k] for k in ('rowSpan','columnSpan') if k in case)
        ocr.require(ok,'SELECTED_CELL_REGRESSION_'+case['id'].upper())
        checks.append({'id':case['id'],'state':'passed','origin':cases['origin']})
    for case in cases['actualContextChecks']:
        texts=''.join(c['text'] for c in by_id[case['sourceId'],case['tableId']][case['field']])
        ocr.require(core.compact(case['mustContain']) in core.compact(texts),'SELECTED_CONTEXT_REGRESSION_'+case['id'].upper())
        checks.append({'id':case['id'],'state':'passed','origin':cases['origin']})
    result={'schemaVersion':1,'state':'engineering_pipeline_verified_review_pending','auditCodeHash':core.sha(Path(__file__).read_bytes()),'pairedOutputBytesIdentical':True,
            'payloadHashes':{'nativeTables':native_hash,'ocrScanTables':scans_hash,'cleanedEvidence':evidence_hash,'ocrResults':ocr_hash,'ocrManifest':manifest_hash,'ocrBatch':batch_hash},
            'nativeTables':{'tables':len(native['tables']),'cells':sum(len(t['cells']) for t in native['tables']),'relationships':sum(len(t['relationshipCandidates']) for t in native['tables']),'quarantinedTables':sum(t['state']=='rejected_cell_structure_do_not_index' for t in native['tables']),'flagCounts':dict(Counter(f for t in native['tables'] for f in t['reviewFlags'])),'partitionIssues':[{'id':t['id'],'wordAccounting':t['wordAccounting']} for t in native['tables'] if any(t['wordAccounting'][k] for k in ('missingWordIds','duplicateWordIds','unknownWordIds'))]},
            'ocr':{'engine':manifest['engine'],'items':len(manifest['items']),'sourceImagesTiled':len(groups),'recognizedRendersPerRun':len(results),'issuedCallsPerRun':recognized['issuedCalls'],'pairedVerificationCalls':recognized['issuedCalls']*2,'exactNormalizedAgreements':sum(x['comparison']['exactNormalizedTextAgreement'] for x in manifest['items']),'criticalDisagreements':sum(not x['comparison']['criticalTokenAgreement'] for x in manifest['items']),'emptyBoth':sum(x['comparison']['emptyBoth'] for x in manifest['items']),'sourceTileCoverageVerified':True,'allConfidenceValuesNull':True,'allItemsRequireReview':True},
            'scanGridCandidates':{'perRenderTables':len(scans['tables']),'perRenderCells':sum(len(t['cells']) for t in scans['tables']),'scope':'Two renders not unique source tables; raw OCR retained, no correction applied.'},
            'evidenceCandidates':dict(Counter(x['state'] for x in evidence['evidenceCandidates'])),
            'selectedRegressionChecks':checks,'independentHumanReview':'pending','independentAcceptanceScore':None,
            'admission':{'persistCandidates':True,'publishNewFacts':False,'replaceExistingEvidence':False,'buildOrReplaceVectors':False,'reasons':['Unreviewed OCR, table semantics and evidence candidates','Known cell partition, ambiguous locator and OCR character failures remain explicit']},
            'factsPublished':0,'indexesChanged':0,'modelCalls':0,'networkSourceRequests':0}
    ocr.parsing.write_once(args.output,result)
    print(json.dumps({k:result[k] for k in ('state','nativeTables','ocr','scanGridCandidates','evidenceCandidates')},ensure_ascii=False))


if __name__=='__main__':
    parser=ArgumentParser(description=__doc__)
    for name in ('table-first','table-second','ocr-first','ocr-second','scan-first','scan-second','evidence-first','evidence-second','cases','output'):
        parser.add_argument('--'+name,type=Path,required=True)
    audit(parser.parse_args())
