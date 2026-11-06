"""Re-anchor existing evidence into cleaned text candidates; never overwrite frozen locators."""
from argparse import ArgumentParser
from pathlib import Path
from collections import Counter
import importlib.util
import json
import re

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('parsing', ROOT / 'scripts/parse-health-documents.py')
parsing = importlib.util.module_from_spec(spec);spec.loader.exec_module(parsing)
core = parsing.core


def anchor(evidence, enhanced):
    if evidence['locator']['kind'] in ('pdf_visual','html_visual'):
        return {'state':'visual_original_requires_review','candidateLocator':None}
    # Map every non-whitespace character back to its actual enhanced-text position.
    positions = [i for i,c in enumerate(enhanced['text']) if not c.isspace()]
    normalized = ''.join(enhanced['text'][i] for i in positions)
    needle = core.compact(evidence['originalSpan'])
    if not needle:
        raise ValueError('EMPTY_EVIDENCE_SPAN')
    matches = []
    for match in re.finditer('(?='+re.escape(needle)+')',normalized):
        start,end = positions[match.start()],positions[match.start()+len(needle)-1]+1
        ranges = [r for r in enhanced['ranges'] if r['start']<end and r['end']>start]
        pages = sorted({r['page'] for r in ranges if 'page' in r})
        if evidence['locator'].get('pdfPage') and pages != [evidence['locator']['pdfPage']]:
            continue
        matches.append({'kind':'enhanced_text_with_source_blocks','start':start,'end':end,'pages':pages,'sourceRanges':ranges,'normalization':'remove_unicode_whitespace_v1'})
    if len(matches)!=1:
        return {'state':'ambiguous_do_not_index' if matches else 'not_located_do_not_index','candidateLocator':None,'matchingOccurrences':len(matches)}
    locator=matches[0]
    span=enhanced['text'][locator['start']:locator['end']]
    if core.compact(span)!=needle:
        raise ValueError('EVIDENCE_ANCHOR_NOT_EXACT')
    return {'state':'located_candidate_requires_review','candidateLocator':locator,'cleanedSpan':span,'matchingOccurrences':1}


def build(args):
    output=args.output.resolve()
    if not output.is_relative_to(ROOT/'.local-data'):
        raise ValueError('EVIDENCE_CANDIDATES_MUST_BE_PRIVATE')
    load=lambda p:json.loads(p.read_text(encoding='utf-8'))
    report=load(args.parser_root/'report.json')
    if report['state']!='research_candidates_not_semantically_approved':
        raise ValueError('PARSER_INPUT_INCOMPLETE')
    evidence=load(ROOT/'datasets/health/2026-10-28-v2/knowledge-bundle.json')['evidence']+load(ROOT/'datasets/health/goal-guidance-2026-11-04-v1/knowledge.json')['evidence']
    documents={}
    for row in report['sources']:
        sid=row['id']
        if not re.fullmatch(r'[a-z0-9][a-z0-9.-]{0,100}',sid):
            raise ValueError('SOURCE_ID_INVALID')
        raw=(args.parser_root/sid/'manifest.json').read_bytes();m=json.loads(raw)
        data=(args.parser_root/sid/'enhanced.json').read_bytes()
        if core.sha(raw)!=row['manifestHash'] or core.sha(data)!=m['outputs']['enhanced.json']:
            raise ValueError('PARSER_INPUT_INTEGRITY')
        documents[sid]=(row,json.loads(data),core.sha(data))
    candidates=[]
    for ev in evidence:
        row,enhanced,digest=documents[ev['sourceId']]
        if ev['sourceHash']!=row['sourceHash']:
            raise ValueError('EVIDENCE_SOURCE_IDENTITY')
        item={'originalEvidenceId':ev['id'],'sourceId':ev['sourceId'],'sourceHash':ev['sourceHash'],'originalSpan':ev['originalSpan'],'originalLocator':ev['locator'],'enhancedPayloadHash':digest,**anchor(ev,enhanced),'reviewOrigin':'project_agent_candidate','semanticApproval':False}
        item['id']='clean-ev:'+core.sha(parsing.encoded(item))
        candidates.append(item)
    result={'schemaVersion':1,'id':'cleaned-evidence-candidates-v2','parserReportHash':core.sha((args.parser_root/'report.json').read_bytes()),'codeHash':core.sha(Path(__file__).read_bytes()),'evidenceCandidates':candidates,'factsCreated':0,'indexesChanged':0,'independentHumanReview':'pending'}
    digest=parsing.write_once(output/'evidence-candidates.json',result)
    summary={k:result[k] for k in ('schemaVersion','id','parserReportHash','codeHash','factsCreated','indexesChanged','independentHumanReview')}
    summary.update({'fullPayloadHash':digest,'candidateCount':len(candidates),'states':dict(Counter(x['state'] for x in candidates)),'candidates':[{'id':x['id'],'originalEvidenceId':x['originalEvidenceId'],'sourceId':x['sourceId'],'state':x['state']} for x in candidates],'state':'locator_candidates_not_fact_publication'})
    parsing.write_once(args.summary,summary)
    print(json.dumps({'candidateCount':len(candidates),'states':summary['states']}))


if __name__=='__main__':
    parser=ArgumentParser(description=__doc__)
    for name in ('parser-root','output','summary'):
        parser.add_argument('--'+name,type=Path,required=True)
    build(parser.parse_args())
