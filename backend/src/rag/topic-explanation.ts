/** Versioned explanatory knowledge, separate from executable food exclusion rules. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import type {HealthInputUnderstanding} from '../health-input-understanding';
const base=new URL('../../../datasets/health/thyroid-iodine-explanation-2026-11-13-v1/',import.meta.url);
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
interface ExplanationFact {id:string;section:string;statement:string;evidenceIds:string[];qualifyingEvidenceIds?:string[];conditions?:string[];kind?:string;origin?:string}
export interface TopicExplanationKnowledge {
 id:string;clinicalRelease:null;professionalReview:'pending';
 topic:{id:string;conditionAliases:string[];foodAliases:string[];scope:string};
 sources:{id:string;title:string;url:string;sourceHash:string;license:string}[];
 evidence:{id:string;sourceId:string;sourceHash:string;originalSpan:string;spanHash:string;locator:{start:number;end:number;parentHash:string;bodyLocator:string};extraction:string}[];
 facts:ExplanationFact[];limitations:(ExplanationFact&{patientPortionGrams?:null;patientFrequencyPerWeek?:null;conversionAllowed?:false})[];
 followup:string;boundaries:{newExecutableRules:false;newVectors:false;pgImported:false;personalDataIncluded:false};
}
export function validateTopicExplanation(raw:unknown):TopicExplanationKnowledge{
 const k=raw as TopicExplanationKnowledge;
 if(!k||typeof k!=='object'||k.id!=='thyroid-iodine-explanation-2026-11-13-v1'||k.clinicalRelease!==null||k.professionalReview!=='pending'||!k.topic?.conditionAliases?.length||!Array.isArray(k.sources)||!Array.isArray(k.evidence)||!Array.isArray(k.facts)||!Array.isArray(k.limitations)||!k.followup||!k.boundaries||Object.values(k.boundaries).some(v=>v!==false&&v!==true))throw Error('TOPIC_EXPLANATION_INVALID');
 if(k.boundaries.newExecutableRules||k.boundaries.newVectors||k.boundaries.pgImported||k.boundaries.personalDataIncluded)throw Error('TOPIC_EXPLANATION_NOT_EXECUTABLE');
 const sources=new Map(k.sources.map(s=>[s.id,s])),evidence=new Set(k.evidence.map(e=>e.id));
 if(sources.size!==k.sources.length||evidence.size!==k.evidence.length)throw Error('TOPIC_EXPLANATION_DUPLICATE');
 for(const s of k.sources){const url=new URL(s.url);if(url.protocol!=='https:'||!['www.niddk.nih.gov','www.cfs.gov.hk'].includes(url.hostname)||!s.license||!/^[a-f0-9]{64}$/.test(s.sourceHash))throw Error('TOPIC_SOURCE_INVALID');}
 for(const e of k.evidence)if(e.sourceHash!==sources.get(e.sourceId)?.sourceHash||sha(e.originalSpan)!==e.spanHash||e.locator.end-e.locator.start!==[...e.originalSpan].length||!/^[a-f0-9]{64}$/.test(e.locator.parentHash))throw Error('TOPIC_EVIDENCE_INVALID');
 for(const f of [...k.facts,...k.limitations])if(!f.id||!f.section||!f.statement||!f.evidenceIds.length||[...f.evidenceIds,...f.qualifyingEvidenceIds??[]].some(id=>!evidence.has(id)))throw Error('TOPIC_FACT_SUPPORT_MISSING');
 if(k.limitations.some(l=>l.patientFrequencyPerWeek!==undefined&&l.patientFrequencyPerWeek!==null||l.patientPortionGrams!==undefined&&l.patientPortionGrams!==null||l.conversionAllowed!==undefined&&l.conversionAllowed!==false))throw Error('TOPIC_PATIENT_AMOUNT_NOT_ESTABLISHED');
 return k;
}
export async function readTopicExplanation(){
 const raw=await readFile(new URL('knowledge.json',base)),manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
 if(sha(raw)!==manifest.files?.['knowledge.json'])throw Error('TOPIC_EXPLANATION_HASH_MISMATCH');
 return {knowledge:validateTopicExplanation(JSON.parse(raw.toString('utf8'))),sha256:sha(raw)};
}
export async function explainKnownTopic(understanding:HealthInputUnderstanding,text:string){
 const {knowledge:k,sha256}=await readTopicExplanation();
 if(understanding.intent!=='food_guidance'||!understanding.conditions.some(n=>k.topic.conditionAliases.includes(n)))return undefined;
 // Narrow scope is explicit. A thyroid question about an unrelated food isn't
 // answered with a seaweed paragraph simply because its condition name matches.
 if(!k.topic.foodAliases.some(n=>text.includes(n))&&!/食材|饮食|吃什么|怎么吃/.test(text))return undefined;
 const selected=k.facts.filter(f=>f.kind!=='exception'||/妊娠|怀孕|孕期|哺乳/.test(text)).filter(f=>f.kind!=='evidence_limit'||/补充|硒|维生素D/.test(text)).filter(f=>f.kind!=='food_source_context_only'||!understanding.allergies.length&&!understanding.avoids.length);
 const order=['能否吃','频率','量','食材选择','特殊条件','补充剂'];
 const facts=[...selected,...k.limitations].sort((a,b)=>order.indexOf(a.section)-order.indexOf(b.section));
 const ids=new Set(facts.flatMap(f=>[...f.evidenceIds,...f.qualifyingEvidenceIds??[]]));
 const answer=facts.map(f=>`${f.section}：${f.statement}`).join('\n')+(understanding.allergies.length||understanding.avoids.length?'\n本次过敏忌口已保留，不据一般含碘来源信息额外推荐受限食材。':'')+`\n出处：NIH/NIDDK、香港食物安全中心。\n还需确认：${k.followup}`;
 return {id:k.id,sha256,answer,facts,evidence:k.evidence.filter(e=>ids.has(e.id)),sources:k.sources,clinicalRelease:null,professionalReview:k.professionalReview,coverage:'qualitative_explanation_only',scope:k.topic.scope,unmetNeeds:['patient_specific_frequency_and_grams','no_executable_hypothyroid_food_rules'],newVectors:false,pgImported:false};
}
