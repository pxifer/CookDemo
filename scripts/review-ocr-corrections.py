"""Create a separate engineering-corrected OCR view; raw OCR and semantic status stay unchanged."""
from argparse import ArgumentParser
from pathlib import Path
import importlib.util
import json

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('ocr',ROOT/'scripts/ocr-health-documents.py')
ocr=importlib.util.module_from_spec(spec);spec.loader.exec_module(ocr)


def correct_result(result,proposals):
    ocr.require(result['state']=='recognized_requires_review','OCR_RESULT_NOT_RECOGNIZED')
    words={w['id']:w for line in result['lines'] for w in line['words']}
    replacements={};consumed=set();records=[]
    for proposal in proposals:
        ids=proposal['rawWordIds']
        ocr.require(proposal['jobId']==result['id'] and proposal['imageHash']==result['imageHash'] and proposal['origin']=='project_agent_visual_proposal' and proposal['independentHumanReview'] is False and proposal['state']=='proposed_not_applied' and len(proposal['visualCropHash'])==64,'CORRECTION_PROVENANCE')
        ocr.require(ids and len(set(ids))==len(ids) and not consumed.intersection(ids) and all(i in words for i in ids),'CORRECTION_WORD_IDS')
        line=next((line for line in result['lines'] if all(i in [w['id'] for w in line['words']] for i in ids)),None)
        ocr.require(line is not None,'CORRECTION_CROSSES_LINES')
        line_ids=[w['id'] for w in line['words']];start=line_ids.index(ids[0])
        ocr.require(line_ids[start:start+len(ids)]==ids,'CORRECTION_NOT_CONTIGUOUS')
        raw=''.join(words[i]['text'] for i in ids)
        ocr.require(raw==proposal['rawText'] and proposal['suggestedText'].strip() and raw!=proposal['suggestedText'],'CORRECTION_RAW_MISMATCH')
        replacements[ids[0]]=proposal['suggestedText'];consumed.update(ids)
        records.append({**proposal,'state':'applied_to_derived_view_only','clinicalApproval':False})
    lines=[]
    for line in result['lines']:
        text=[]
        for word in line['words']:
            if word['id'] in replacements:text.append(replacements[word['id']])
            elif word['id'] not in consumed:text.append(word['text'])
        lines.append({'sourceLineId':line['id'],'text':' '.join(text),'rawWordIds':[w['id'] for w in line['words']]})
    return {'jobId':result['id'],'imageHash':result['imageHash'],'rawText':result['text'],'correctedText':'\n'.join(x['text'] for x in lines),'lines':lines,'corrections':records,'state':'engineering_transcription_view_requires_review','semanticApproval':False,'independentHumanReview':False}


if __name__=='__main__':
    parser=ArgumentParser(description=__doc__)
    for name in ('ocr-root','corrections','output','summary'):
        parser.add_argument('--'+name,type=Path,required=True)
    args=parser.parse_args();out=ocr.private_directory(args.output)
    raw=ocr.load(args.ocr_root/'ocr-results.json');proposals=ocr.load(args.corrections)['proposals']
    results={x['id']:x for x in raw['results']}
    ocr.require(all(p['jobId'] in results for p in proposals),'CORRECTION_UNKNOWN_RESULT')
    views=[correct_result(value,[p for p in proposals if p['jobId']==ident]) for ident,value in results.items() if any(p['jobId']==ident for p in proposals)]
    report={'schemaVersion':1,'parentOcrHash':ocr.core.sha((args.ocr_root/'ocr-results.json').read_bytes()),'proposalHash':ocr.core.sha(args.corrections.read_bytes()),'codeHash':ocr.core.sha(Path(__file__).read_bytes()),'views':views,'rawOcrOverwritten':False,'factsPublished':0,'indexesChanged':0,'independentHumanReview':'pending'}
    digest=ocr.parsing.write_once(out/'engineering-corrected-ocr.json',report)
    summary={k:report[k] for k in ('schemaVersion','parentOcrHash','proposalHash','codeHash','rawOcrOverwritten','factsPublished','indexesChanged','independentHumanReview')}
    summary.update({'fullPayloadHash':digest,'views':len(views),'appliedCorrections':len(proposals),'origin':'project_agent_visual_proposal','state':'separate_engineering_view_not_semantic_approval'})
    ocr.parsing.write_once(args.summary,summary)
    print(json.dumps(summary))
