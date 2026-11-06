"""Verify selected source exception fixes without approving health facts or hiding bad evidence."""
from argparse import ArgumentParser
from pathlib import Path
from collections import Counter
import importlib.util
import json

ROOT=Path(__file__).resolve().parents[1]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
parsing=module('parsing',ROOT/'scripts/parse-health-documents.py');core=parsing.core
load=lambda p:json.loads(p.read_text(encoding='utf8'))
def require(ok,reason):
    if not ok:raise ValueError(reason)
def pair(a,b,name):
    raw=(a/name).read_bytes();require(raw==(b/name).read_bytes(),'PAIR_BYTES_DIFFER')
    return json.loads(raw),core.sha(raw)

if __name__=='__main__':
    parser=ArgumentParser(description=__doc__)
    for name in ('tables-first','tables-second','evidence-first','evidence-second','cases','parser-verification','output'):
        parser.add_argument('--'+name,type=Path,required=True)
    args=parser.parse_args();cases=load(args.cases);parsed=load(args.parser_verification)
    require(parsed['toolchain']['codeHash']==core.sha((ROOT/'scripts/parse-health-documents.py').read_bytes()+(ROOT/'scripts/lib/document-parser.py').read_bytes()),'PARSER_CODE_IDENTITY')
    tables,table_hash=pair(args.tables_first,args.tables_second,'table-review.json')
    evidence,evidence_hash=pair(args.evidence_first,args.evidence_second,'evidence-candidates.json')
    require(tables['codeHash']==core.sha((ROOT/'scripts/build-table-review.py').read_bytes()+(ROOT/'scripts/lib/table-review.py').read_bytes()),'TABLE_CODE_HASH')
    require(evidence['codeHash']==core.sha((ROOT/'scripts/build-evidence-candidates.py').read_bytes()),'EVIDENCE_CODE_HASH')
    require(parsed['policy']==core.POLICY and parsed['sourceCount']==13 and parsed['parsedUnits']==479 and parsed['allSourceAtomsOrWordsAccountedExactlyOnce'] and parsed['allEnhancementRangesVerified'],'PARSER_NOT_VERIFIED')
    require(tables['parserReportHash']==evidence['parserReportHash'],'CANDIDATE_PARENT_IDENTITY')
    by_table={(t['sourceId'],t['sourceTableId']):t for t in tables['tables']};by_ev={e['originalEvidenceId']:e for e in evidence['evidenceCandidates']}
    table_checks=[]
    for case in cases['tables']:
        t=by_table[case['sourceId'],case['tableId']]
        require(t['columnCountCandidate']==case['columns'] and t['columnBoundaryEvidence'] and t['method']=='aligned_whitespace_candidate','REAL_TABLE_COLUMNS')
        require(all(not t['wordAccounting'][k] for k in ('missingWordIds','duplicateWordIds','unknownWordIds')),'TABLE_WORD_PARTITION')
        require(not t['semanticApproval'] and t['state']=='table_candidate_requires_review','TABLE_STATE')
        table_checks.append({'id':t['id'],'sourceHash':t['sourceHash'],'page':t['page'],'columns':t['columnCountCandidate'],'cells':len(t['cells']),'columnBoundaryEvidence':t['columnBoundaryEvidence'],'wordAccounting':t['wordAccounting'],'businessScope':case['businessScope'],'foodGuidanceApproved':False})
    ev_checks=[]
    for case in cases['evidence']:
        ev=by_ev[case['id']];require(ev['state']==case.get('state','located_candidate_requires_review') and not ev['semanticApproval'],'EVIDENCE_EXPECTATION')
        if case['cause']=='legacy_offset_plus_context':require(ev['resolutionProof']['method']=='verified_legacy_offset_and_adjacent_context','OLD_CONTEXT_PROOF')
        if case.get('mustFlag'):require(case['mustFlag'] in ev['reviewFlags'],'SUPPORT_ROLE_WARNING_MISSING')
        if ev['state']=='legacy_navigation_anchor_do_not_index':
            require(ev['candidateLocator'] is None and ev['resolutionProof']['method']=='exact_legacy_stream_and_removed_dom_nodes' and ev['replacementContextCandidates'],'BAD_NAVIGATION_PROMOTED')
        ev_checks.append({'id':ev['originalEvidenceId'],'candidateId':ev['id'],'sourceHash':ev['sourceHash'],'state':ev['state'],'reviewFlags':ev['reviewFlags'],'resolutionProof':ev.get('resolutionProof'),'replacementContextCount':len(ev.get('replacementContextCandidates',[]))})
    require(all(not t['semanticApproval'] and not r['approvedFact'] for t in tables['tables'] for r in t['relationshipCandidates']),'RELATION_PUBLISHED')
    require(tables['factsPublished']==evidence['factsCreated']==tables['indexesChanged']==evidence['indexesChanged']==0,'PUBLICATION_BOUNDARY')
    report={'schemaVersion':1,'state':'engineering_exception_resolution_verified_not_publication','policy':core.POLICY,'codeHash':core.sha(Path(__file__).read_bytes()),'parserVerificationHash':core.sha(args.parser_verification.read_bytes()),'casesHash':core.sha(args.cases.read_bytes()),'pairedOutputBytesIdentical':True,'payloadHashes':{'tables':table_hash,'evidence':evidence_hash},'tableCount':len(tables['tables']),'cellCount':sum(len(t['cells']) for t in tables['tables']),'relationshipCount':sum(len(t['relationshipCandidates']) for t in tables['tables']),'quarantinedStructures':sum(t['state']=='rejected_cell_structure_do_not_index' for t in tables['tables']),'selectedTableChecks':table_checks,'evidenceStates':dict(Counter(e['state'] for e in evidence['evidenceCandidates'])),'selectedEvidenceChecks':ev_checks,'factsPublished':0,'indexesChanged':0,'ocrCallsThisBatch':0,'generativeApiCalls':0,'independentHumanReview':'pending','scope':'Geometry and exact locator fixes only. Invalid navigation evidence isolated; source body replacement contexts still require curation. No new independent score.'}
    parsing.write_once(args.output,report)
    print(json.dumps({k:report[k] for k in ('state','tableCount','cellCount','relationshipCount','quarantinedStructures','evidenceStates')}))
