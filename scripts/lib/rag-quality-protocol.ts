import {createHash} from 'node:crypto';

export type QualityTask='parsing'|'retrieval'|'food_guidance'|'meal';
export type QualitySplit='development'|'acceptance'|'hard'|'regression';
export interface QualityCase {
  id:string;task:QualityTask;split:QualitySplit;questionFamily:string;sourceFamilies:string[];sourceHashes:string[];topics:string[];
  exposure:'used_for_tuning'|'new_unscored';input:Record<string,unknown>;gold:Record<string,unknown>|null;
  requiresProfessionalReview:boolean;
  review:{status:'pending'|'adjudicated';origin:'project_agent'|'human';independent:boolean;reviewerId:string|null;role:'engineering'|'nutrition_medical'|null;date:string|null;rationale:string|null};
}
export interface QualitySuite {schemaVersion:1;id:string;holdoutPolicy:'source_disjoint'|'question_family_disjoint';cases:QualityCase[]}
export interface ExposureRegistry {datasetIds:string[];questionFamilies:string[];sourceFamilies:string[];sourceHashes:string[]}
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,canonical(v)])):typeof value==='string'?value.normalize('NFKC').replace(/\s+/g,' ').trim():value;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const text=(x:unknown):x is string=>typeof x==='string'&&x.trim().length>0;
const strings=(x:unknown):x is string[]=>Array.isArray(x)&&x.every(text)&&new Set(x).size===x.length;
const object=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x);
const held=(split:string)=>split==='acceptance'||split==='hard';
const tasks=['parsing','retrieval','food_guidance','meal'];
function leakedKeys(value:unknown):boolean {
  if(Array.isArray(value))return value.some(leakedKeys);
  return object(value)&&Object.entries(value).some(([key,v])=>/^(?:gold|expected|labels?|review|relevance|answerKey|allowedRecipes|forbiddenRecipes)$/i.test(key)||leakedKeys(v));
}
/** Project labels remain engineering regressions; a split name cannot make them independent. */
export function auditQualitySuite(raw:unknown,registry:ExposureRegistry){
  const errors:string[]=[],pending:string[]=[];
  if(!object(registry)||!['datasetIds','questionFamilies','sourceFamilies','sourceHashes'].every(key=>strings(registry[key])))throw Error('EXPOSURE_REGISTRY_SHAPE');
  if(!object(raw)||raw.schemaVersion!==1||!text(raw.id)||!['source_disjoint','question_family_disjoint'].includes(String(raw.holdoutPolicy))||!Array.isArray(raw.cases))throw Error('QUALITY_SUITE_SHAPE');
  const cases:QualityCase[]=[],ids=new Set<string>();
  for(const item of raw.cases){
    if(!object(item)||!text(item.id)||!tasks.includes(String(item.task))||!['development','acceptance','hard','regression'].includes(String(item.split))||!text(item.questionFamily)||!strings(item.sourceFamilies)||!item.sourceFamilies.length||!strings(item.sourceHashes)||!item.sourceHashes.length||item.sourceHashes.some(h=>!/^[a-f0-9]{64}$/.test(h))||!strings(item.topics)||!item.topics.length||!['used_for_tuning','new_unscored'].includes(String(item.exposure))||!object(item.input)||leakedKeys(item.input)||!(item.gold===null||object(item.gold))||typeof item.requiresProfessionalReview!=='boolean'||!object(item.review)){
      errors.push(`case_shape_or_input_leak:${String(item?.id??'unknown')}`);continue;
    }
    const c=item as unknown as QualityCase,r=c.review;
    if(ids.has(c.id))errors.push(`duplicate_case:${c.id}`);ids.add(c.id);
    if(!['pending','adjudicated'].includes(r.status)||!['project_agent','human'].includes(r.origin)||typeof r.independent!=='boolean'||![null,'engineering','nutrition_medical'].includes(r.role)||(r.reviewerId!==null&&!text(r.reviewerId))||(r.rationale!==null&&!text(r.rationale))||(r.date!==null&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date+'T00:00:00Z'))||new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)!==r.date)))errors.push(`review_shape:${c.id}`);
    const separateSource=raw.holdoutPolicy==='source_disjoint'||c.task==='parsing';
    if(held(c.split)&&(c.exposure==='used_for_tuning'||registry.datasetIds.includes(raw.id)||registry.questionFamilies.includes(c.questionFamily)||separateSource&&(c.sourceFamilies.some(x=>registry.sourceFamilies.includes(x))||c.sourceHashes.some(x=>registry.sourceHashes.includes(x)))))errors.push(`contaminated_holdout:${c.id}`);
    if(r.status==='adjudicated'&&(!text(r.reviewerId)||!text(r.rationale)||!r.date||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!c.gold))errors.push(`incomplete_review:${c.id}`);
    if(r.independent&&(r.origin!=='human'||r.status!=='adjudicated'))errors.push(`false_independent_review:${c.id}`);
    if(c.requiresProfessionalReview&&r.status==='adjudicated'&&r.independent&&r.role!=='nutrition_medical')errors.push(`professional_review_required:${c.id}`);
    if(held(c.split)&&(!c.gold||r.status!=='adjudicated'||r.origin!=='human'||!r.independent))pending.push(c.id);
    cases.push(c);
  }
  for(let i=0;i<cases.length;i++)for(let j=i+1;j<cases.length;j++){
    const a=cases[i],b=cases[j];if(a.split===b.split||!held(a.split)&&!held(b.split))continue;
    const separateSource=raw.holdoutPolicy==='source_disjoint'||a.task==='parsing'||b.task==='parsing';
    if(a.questionFamily===b.questionFamily||separateSource&&(a.sourceFamilies.some(x=>b.sourceFamilies.includes(x))||a.sourceHashes.some(x=>b.sourceHashes.includes(x)))||hash(a.input)===hash(b.input))errors.push(`cross_split_leak:${a.id}:${b.id}`);
  }
  const coverage=Object.fromEntries(tasks.map(task=>[task,cases.filter(c=>c.task===task).length]));
  const reserved=cases.filter(c=>held(c.split));
  return {id:raw.id,sha256:hash(raw),holdoutPolicy:raw.holdoutPolicy,sharedCorpusDisclosure:reserved.filter(c=>c.sourceHashes.some(h=>registry.sourceHashes.includes(h))).map(c=>c.id),errors,pendingIndependentReview:pending,pendingAnnotation:cases.filter(c=>!c.gold||c.review.status==='pending').map(c=>c.id),holdoutStatus:reserved.length?'candidate_or_reviewed':'not_created',coverage,counts:Object.fromEntries(['development','acceptance','hard','regression'].map(s=>[s,cases.filter(c=>c.split===s).length])),
    independentAcceptanceReady:errors.length===0&&reserved.some(c=>c.split==='acceptance')&&pending.length===0,
    scope:'Declared review metadata only; this tool does not verify reviewer identity or confer clinical approval.'};
}
/** This is the only permitted export to inference: labels, split and reviewer data stay in scoring. */
export function qualityInferenceInput(c:QualityCase){
  if(leakedKeys(c.input))throw Error('QUALITY_INPUT_CONTAINS_LABELS');
  return structuredClone({id:c.id,task:c.task,input:c.input});
}
export function canonicalQualityJson(raw:unknown){return JSON.stringify(raw,null,2)+'\n';}
