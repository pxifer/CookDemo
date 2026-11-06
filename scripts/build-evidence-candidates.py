"""Re-anchor existing evidence into cleaned text candidates; never overwrite frozen locators."""
from argparse import ArgumentParser
from pathlib import Path
from collections import Counter
import importlib.util
import json
import re
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('parsing', ROOT / 'scripts/parse-health-documents.py')
parsing = importlib.util.module_from_spec(spec);spec.loader.exec_module(parsing)
core = parsing.core


def legacy_html_text(raw,normalization):
    class Text(HTMLParser):
        def __init__(self):super().__init__(convert_charrefs=True);self.parts=[];self.skip=0
        def handle_starttag(self,tag,attrs):
            if tag in ('script','style'):self.skip+=1
        def handle_endtag(self,tag):
            if tag in ('script','style'):self.skip=max(0,self.skip-1)
        def handle_data(self,text):
            if normalization=='collapse_whitespace_v1' or not self.skip:self.parts.append(text)
    parser=Text();parser.feed(raw.decode('utf-8-sig',errors='strict'))
    if normalization=='collapse_whitespace_v1':
        # Exact historical goal builder; this stream verifies offsets, never retrieval text.
        return re.sub(r'\s+',' ',' '.join(parser.parts))
    if normalization=='remove_unicode_whitespace_v1':return core.compact(''.join(parser.parts))
    raise ValueError('UNSUPPORTED_LEGACY_NORMALIZATION')


def removed_navigation_origin(evidence,document,legacy):
    loc=evidence['locator']
    if loc.get('normalization')!='remove_unicode_whitespace_v1':return None
    start,end=loc.get('start',-1),loc.get('end',-1)
    if not 0<=start<end<=len(legacy) or legacy[start:end]!=evidence['originalSpan']:return None
    removed={x['atomId']:x['reason'] for x in document['removed']}
    atoms=[a for a in document['rawAtoms'] if removed.get(a['id'])!='executable_or_style']
    if ''.join(core.compact(a['rawText']) for a in atoms)!=legacy:return None
    selected=[];pos=0
    for atom in atoms:
        stop=pos+len(core.compact(atom['rawText']))
        if pos<end and stop>start:selected.append(atom)
        pos=stop
    if not selected or not all(removed.get(a['id'])=='explicit_navigation_or_hidden' for a in selected):return None
    return {'method':'exact_legacy_stream_and_removed_dom_nodes','legacyNormalizedTextHash':core.sha(legacy.encode('utf8')),'verifiedOldStart':start,'verifiedOldEnd':end,'atoms':[{'id':a['id'],'locator':a['locator']} for a in selected]}


def anchor(evidence, enhanced, legacy_text=None):
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
    proof=None;original_count=len(matches)
    if len(matches)>1 and legacy_text is not None:
        start,end=evidence['locator'].get('start',-1),evidence['locator'].get('end',-1)
        if 0<=start<end<=len(legacy_text) and legacy_text[start:end]==evidence['originalSpan']:
            prefix=core.compact(legacy_text[max(0,start-48):start]);suffix=core.compact(legacy_text[end:end+48])
            chosen=[m for m in matches if prefix and suffix and core.compact(enhanced['text'][:m['start']]).endswith(prefix) and core.compact(enhanced['text'][m['end']:]).startswith(suffix)]
            if len(chosen)==1:
                matches=chosen
                proof={'method':'verified_legacy_offset_and_adjacent_context','legacyNormalizedTextHash':core.sha(legacy_text.encode('utf8')),'verifiedOldStart':start,'verifiedOldEnd':end,'prefixHash':core.sha(prefix.encode('utf8')),'suffixHash':core.sha(suffix.encode('utf8')),'originalMatchingOccurrences':original_count}
    if len(matches)!=1:
        return {'state':'ambiguous_do_not_index' if matches else 'not_located_do_not_index','candidateLocator':None,'matchingOccurrences':len(matches)}
    locator=matches[0]
    span=enhanced['text'][locator['start']:locator['end']]
    if core.compact(span)!=needle:
        raise ValueError('EVIDENCE_ANCHOR_NOT_EXACT')
    return {'state':'located_candidate_requires_review','candidateLocator':locator,'cleanedSpan':span,'matchingOccurrences':1,**({'resolutionProof':proof} if proof else {})}


def build(args):
    output=args.output.resolve()
    if not output.is_relative_to(ROOT/'.local-data'):
        raise ValueError('EVIDENCE_CANDIDATES_MUST_BE_PRIVATE')
    load=lambda p:json.loads(p.read_text(encoding='utf-8'))
    report=load(args.parser_root/'report.json')
    if report['state']!='research_candidates_not_semantically_approved':
        raise ValueError('PARSER_INPUT_INCOMPLETE')
    evidence=load(ROOT/'datasets/health/2026-10-28-v2/knowledge-bundle.json')['evidence']+load(ROOT/'datasets/health/goal-guidance-2026-11-04-v1/knowledge.json')['evidence']
    documents={};source_registry={s['id']:s for s in load(ROOT/'datasets/health/source-rebuild-registry-v1.json')['sources']}
    for row in report['sources']:
        sid=row['id']
        if not re.fullmatch(r'[a-z0-9][a-z0-9.-]{0,100}',sid):
            raise ValueError('SOURCE_ID_INVALID')
        raw=(args.parser_root/sid/'manifest.json').read_bytes();m=json.loads(raw)
        data=(args.parser_root/sid/'enhanced.json').read_bytes()
        if core.sha(raw)!=row['manifestHash'] or core.sha(data)!=m['outputs']['enhanced.json']:
            raise ValueError('PARSER_INPUT_INTEGRITY')
        documents[sid]=(row,json.loads(data),core.sha(data),m['outputs']['structure.json'])
    candidates=[]
    for ev in evidence:
        row,enhanced,digest,structure_hash=documents[ev['sourceId']]
        if ev['sourceHash']!=row['sourceHash']:
            raise ValueError('EVIDENCE_SOURCE_IDENTITY')
        result=anchor(ev,enhanced)
        if result['state']=='ambiguous_do_not_index' and ev['locator']['kind']=='html_normalized_text':
            descriptor=source_registry[ev['sourceId']]
            cache=getattr(args,'legacy_health_cache',None) if descriptor['cache']=='health' else getattr(args,'legacy_goal_cache',None)
            if cache:
                raw=parsing.source_file(cache,descriptor['file']).read_bytes()
                if core.sha(raw)!=ev['sourceHash']:raise ValueError('LEGACY_SOURCE_HASH_MISMATCH')
                legacy=legacy_html_text(raw,ev['locator']['normalization'])
                result=anchor(ev,enhanced,legacy)
                source_bytes=(args.parser_root/ev['sourceId']/'structure.json').read_bytes()
                if core.sha(source_bytes)!=structure_hash:raise ValueError('EVIDENCE_ROLE_SOURCE_HASH_MISMATCH')
                document=json.loads(source_bytes)
                navigation=removed_navigation_origin(ev,document,legacy)
                if navigation:
                    roles={a['id']:a['role'] for a in document['retained']};contexts=[]
                    for block in enhanced['ranges']:
                        text=enhanced['text'][block['start']:block['end']]
                        block_roles=[roles[i] for i in block.get('sourceAtomIds',[])]
                        if core.compact(ev['originalSpan']) in core.compact(text) and not text.rstrip().endswith(('?','？')) and block_roles and all(r=='body' for r in block_roles):
                            contexts.append({'sourceRange':block,'contextText':text,'contextHash':core.sha(text.encode('utf8')),'state':'recuration_context_only_not_approved_evidence'})
                    result={'state':'legacy_navigation_anchor_do_not_index','candidateLocator':None,'resolutionProof':navigation,'replacementContextCandidates':contexts,'requiresEvidenceRecuration':True}
        flags=['navigation_fragment_is_not_supporting_evidence'] if result['state']=='legacy_navigation_anchor_do_not_index' else []
        if result.get('candidateLocator') and ev['locator']['kind']=='html_normalized_text':
            structure_raw=(args.parser_root/ev['sourceId']/'structure.json').read_bytes()
            if core.sha(structure_raw)!=structure_hash:raise ValueError('EVIDENCE_ROLE_SOURCE_HASH_MISMATCH')
            document=json.loads(structure_raw)
            roles={a['id']:a['role'] for a in document['retained']}
            selected=[roles[i] for block in result['candidateLocator']['sourceRanges'] for i in block.get('sourceAtomIds',[])]
            if selected and all(role=='heading' for role in selected):flags.append('heading_or_question_fragment_requires_support_context_review')
        item={'originalEvidenceId':ev['id'],'sourceId':ev['sourceId'],'sourceHash':ev['sourceHash'],'originalSpan':ev['originalSpan'],'originalLocator':ev['locator'],'enhancedPayloadHash':digest,**result,'reviewFlags':flags,'reviewOrigin':'project_agent_candidate','semanticApproval':False}
        item['id']='clean-ev:'+core.sha(parsing.encoded(item))
        candidates.append(item)
    result={'schemaVersion':1,'id':'cleaned-evidence-candidates-v3','parserReportHash':core.sha((args.parser_root/'report.json').read_bytes()),'codeHash':core.sha(Path(__file__).read_bytes()),'evidenceCandidates':candidates,'factsCreated':0,'indexesChanged':0,'independentHumanReview':'pending'}
    digest=parsing.write_once(output/'evidence-candidates.json',result)
    summary={k:result[k] for k in ('schemaVersion','id','parserReportHash','codeHash','factsCreated','indexesChanged','independentHumanReview')}
    summary.update({'fullPayloadHash':digest,'candidateCount':len(candidates),'states':dict(Counter(x['state'] for x in candidates)),'candidates':[{'id':x['id'],'originalEvidenceId':x['originalEvidenceId'],'sourceId':x['sourceId'],'state':x['state']} for x in candidates],'state':'locator_candidates_not_fact_publication'})
    parsing.write_once(args.summary,summary)
    print(json.dumps({'candidateCount':len(candidates),'states':summary['states']}))


if __name__=='__main__':
    parser=ArgumentParser(description=__doc__)
    for name in ('parser-root','output','summary'):
        parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--legacy-health-cache',type=Path)
    parser.add_argument('--legacy-goal-cache',type=Path)
    build(parser.parse_args())
