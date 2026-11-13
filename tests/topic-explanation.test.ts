import test from 'node:test';
import assert from 'node:assert/strict';
import {explainKnownTopic,readTopicExplanation,validateTopicExplanation} from '../backend/src/rag/topic-explanation';
import type {HealthInputUnderstanding} from '../backend/src/health-input-understanding';
const input=(conditions:string[]):HealthInputUnderstanding=>({intent:'food_guidance',subject:'self',conditions,goals:[],preferences:[],allergies:[],avoids:[],mealRequest:{ingredients:[],servings:null,counts:null,allowBuy:null},question:''});
test('甲减资料候选可回查原文/限定，不把未给个人量改成数字或可执行规则',async()=>{
 const {knowledge:k}=await readTopicExplanation();assert.equal(k.sources.length,3);assert.equal(k.evidence.length,6);assert.equal(k.clinicalRelease,null);
 const numeric=structuredClone(k);numeric.limitations[0].patientFrequencyPerWeek=2 as any;assert.throws(()=>validateTopicExplanation(numeric),/NOT_ESTABLISHED/);
 const missing=structuredClone(k);missing.facts[0].evidenceIds=['invented'];assert.throws(()=>validateTopicExplanation(missing),/SUPPORT_MISSING/);
 const raw=structuredClone(k);raw.evidence[0].originalSpan+='changed';assert.throws(()=>validateTopicExplanation(raw),/EVIDENCE_INVALID/);
 const answer=await explainKnownTopic(input(['甲减']),'我有甲减，能经常吃海带吗？');assert(answer);for(const term of ['能否吃','频率','量','食材选择','自身免疫','不能'])assert(answer.answer.includes(term));assert.equal(answer.pgImported,false);assert.equal(answer.newVectors,false);
});
test('邻近和反例：桥本/孕期保留条件，甲亢/其他食品不误召回，过敏项不当食材推荐',async()=>{
 const pregnant=await explainKnownTopic(input(['桥本甲状腺炎']),'我怀孕且有桥本甲状腺炎，海带怎么吃？');assert(pregnant?.facts.some(f=>f.kind==='exception'));
 assert.equal(await explainKnownTopic(input(['甲亢']),'甲亢能吃海带吗？'),undefined);
 assert.equal(await explainKnownTopic(input(['甲减']),'甲减能吃豆腐吗？'),undefined);
 const allergy={...input(['甲减']),allergies:['鸡蛋']};const answer=await explainKnownTopic(allergy,'甲减海带怎么吃？');assert(answer);assert(!answer.facts.some(f=>f.kind==='food_source_context_only'));assert(answer.answer.includes('过敏忌口已保留'));
});
