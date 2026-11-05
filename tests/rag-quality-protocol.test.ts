import test from 'node:test';
import assert from 'node:assert/strict';
import {auditQualitySuite,qualityInferenceInput,type QualityCase,type QualitySuite,type ExposureRegistry} from '../scripts/lib/rag-quality-protocol';
const registry:ExposureRegistry={datasetIds:['legacy-27'],questionFamilies:['old-salt-question'],sourceFamilies:['old-guideline'],sourceHashes:['a'.repeat(64)]};
const item=(id:string,split:QualityCase['split']='development'):QualityCase=>({id,task:'retrieval',split,questionFamily:id,sourceFamilies:[id],sourceHashes:[id.charCodeAt(0).toString(16).padStart(2,'0').repeat(32)],topics:['hypertension'],exposure:'new_unscored',input:{query:'明确成人的少盐食材指导'},gold:null,requiresProfessionalReview:true,review:{status:'pending',origin:'project_agent',independent:false,reviewerId:null,role:null,date:null,rationale:null}});
const suite=(...cases:QualityCase[]):QualitySuite=>({schemaVersion:1,id:'new-candidates',holdoutPolicy:'source_disjoint',cases});
test('旧调参题、同原件转载和改名题不能冻结为独立验收；新候选未审核不假称金标准',()=>{
  const a=item('a','acceptance');a.sourceFamilies=['old-guideline'];assert(auditQualitySuite(suite(a),registry).errors.some(e=>e.includes('contaminated')));
  a.sourceFamilies=['new-guideline'];a.sourceHashes=['a'.repeat(64)];assert(auditQualitySuite(suite(a),registry).errors.length);
  a.sourceHashes=['b'.repeat(64)];a.questionFamily='old-salt-question';assert(auditQualitySuite(suite(a),registry).errors.length);
  a.questionFamily='new-family';a.exposure='used_for_tuning';assert(auditQualitySuite(suite(a),registry).errors.length);
  a.exposure='new_unscored';const clean=auditQualitySuite(suite(a),registry);assert.equal(clean.errors.length,0);assert.equal(clean.independentAcceptanceReady,false);assert.deepEqual(clean.pendingIndependentReview,['a']);
});
test('跨划分问题族/来源/文档hash/同输入泄漏均拒绝；主题可分层但不能据此忽略泄漏',()=>{
  const a=item('b'),b=item('c','acceptance');assert(auditQualitySuite(suite(a,b),registry).errors.some(e=>e.includes('cross_split')));
  b.input={query:'另一种问题'};assert.equal(auditQualitySuite(suite(a,b),registry).errors.length,0);
  b.questionFamily=a.questionFamily;assert(auditQualitySuite(suite(a,b),registry).errors.length);
  b.questionFamily='independent';b.sourceFamilies=a.sourceFamilies;assert(auditQualitySuite(suite(a,b),registry).errors.length);
  b.sourceFamilies=['new-source'];b.sourceHashes=a.sourceHashes;assert(auditQualitySuite(suite(a,b),registry).errors.length);
});
test('项目代理和工程标签不能冒充医学独立人审；完整人审声明才具备评分资格',()=>{
 const a=item('c','acceptance');a.gold={relevance:3};a.review={status:'adjudicated',origin:'project_agent',independent:true,reviewerId:'agent',role:'nutrition_medical',date:'2026-11-05',rationale:'构造断言'};assert(auditQualitySuite(suite(a),registry).errors.some(e=>e.includes('false_independent')));
 a.review.origin='human';a.review.role='engineering';assert(auditQualitySuite(suite(a),registry).errors.some(e=>e.includes('professional')));
 a.review.role='nutrition_medical';assert.equal(auditQualitySuite(suite(a),registry).independentAcceptanceReady,true);
 a.review.rationale=null;assert(auditQualitySuite(suite(a),registry).errors.some(e=>e.includes('incomplete')));
});
test('评分gold与审核元数据不会导出到检索生成；嵌套标签偷渡输入被拒',()=>{
 const a=item('d');a.gold={facts:['hidden-gold'],allowedRecipes:['secret-expected']};assert.deepEqual(Object.keys(qualityInferenceInput(a)),['id','task','input']);assert(!JSON.stringify(qualityInferenceInput(a)).includes('hidden-gold'));
 a.input={context:{expected:{fact:'leak'}}};assert.throws(()=>qualityInferenceInput(a),/CONTAINS_LABELS/);assert(auditQualitySuite(suite(a),registry).errors.length);
});
test('固定知识库允许披露共享来源后评测独立问题；仍拒绝旧问题族，不伪称新来源泛化',()=>{
 const a=item('f','acceptance');a.sourceHashes=registry.sourceHashes;a.sourceFamilies=registry.sourceFamilies;
 const data={...suite(a),holdoutPolicy:'question_family_disjoint' as const};const result=auditQualitySuite(data,registry);
 assert.equal(result.errors.length,0);assert.deepEqual(result.sharedCorpusDisclosure,['f']);assert.equal(result.independentAcceptanceReady,false);
 a.questionFamily=registry.questionFamilies[0];assert(auditQualitySuite(data,registry).errors.some(e=>e.includes('contaminated')));
 a.questionFamily='new-family';a.task='parsing';assert(auditQualitySuite(data,registry).errors.length);
});
