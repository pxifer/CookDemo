import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from '../backend/src/db';
import { constructedContent } from '../shared/catalog';
import { contentContext } from '../shared/content';
import { readNutritionExpansion, searchNutritionKnowledge, validateNutritionExpansion } from '../backend/src/rag/nutrition-knowledge';
import { persistNutritionExpansion, loadNutritionExpansion, queryLocalNutritionKnowledge } from '../backend/src/rag/nutrition-knowledge-repository';
import { readFoodGuidanceAssets } from '../backend/src/rag/food-guidance-repository';
import { createFoodGuidanceProvider, bindRecipeGuidance, reportedConditions } from '../backend/src/rag/food-guidance';
import { createNutritionGuidanceProvider, nutritionProfile } from '../backend/src/rag/nutrition-guidance-provider';
import { researchFoodChat } from '../backend/src/rag/food-guidance-chat';
import { canonicalKnowledgeHash } from '../backend/src/health-knowledge';
import { simpleRecipe } from './fixtures';

const {bundle,manifest}=await readNutritionExpansion(),assets=await readFoodGuidanceAssets();
const profile=(conditions:string[]=[],goals:string[]=[],notes='')=>({conditions,goals,notes});
const provider=(revoked=new Set<string>())=>createNutritionGuidanceProvider(createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set(revoked)),bundle,async()=>new Set(revoked));
const cell=(foodId:string,nutrientId:string)=>bundle.values.find(v=>v.foodId===`usda:${foodId}`&&v.nutrientId===nutrientId)!;

test('扩展包：完整矩阵、权威来源与原始行溯源，旧健康schema无需改动',()=>{
  assert.equal(bundle.values.length,bundle.foods.length*bundle.nutrients.length);
  assert.equal(bundle.values.filter(v=>v.value!==null).length,manifest.counts.reportedValues);
  assert.equal(bundle.topics.filter(t=>t.kind==='condition').length,5);
  assert.equal(bundle.topics.filter(t=>t.kind==='goal').length,6);
  assert(bundle.sources.every(s=>s.license&&s.reviewedDate&&s.sourceHash));
  assert(bundle.sources.find(s=>s.publisher==='NHS')!.reviewDue);
  assert.equal(bundle.sources.find(s=>s.publisher==='NIH Office of Dietary Supplements')!.acquisition,'web_tool_rendered_excerpt');
  assert(bundle.exclusions.some(e=>'url' in e&&e.url.includes('medlineplus')));
});
test('USDA样本：每100g原值与单位保真，生熟/强化不合并也不据差值声称烹调损失',()=>{
  assert.equal(cell('170379','vitamin-c').value,89.2);assert.equal(cell('170379','vitamin-c').unit,'MG');
  assert.equal(cell('169967','vitamin-c').value,64.9);
  assert.equal(cell('175167','vitamin-d').value,11);assert.equal(cell('175167','vitamin-d').unit,'UG');
  assert.equal(cell('175167','energy').value,208);assert.equal(cell('175167','energy').unit,'KCAL');
  assert.equal(cell('175167','protein').value,20.42);assert.equal(cell('175167','protein').unit,'G');
  assert.equal(cell('172217','vitamin-d').value,0.1);assert.equal(cell('171265','vitamin-d').value,1.3);
});
test('缺失和源报零不同：不填B7、不把未报告C或未检出推成绝对无成分',()=>{
  assert(bundle.values.filter(v=>v.nutrientId==='biotin').every(v=>v.value===null&&v.status==='not_reported'&&v.sourceRow===null));
  assert.equal(cell('169242','vitamin-c').value,null);
  assert.equal(cell('172217','vitamin-c').value,0);assert.equal(cell('172217','vitamin-c').status,'source_reported');
});
for(const corruption of ['unit','value','source','locator','missing','rule','duplicate'] as const)test(`运行校验拒绝损坏：${corruption}`,()=>{
  const copy=structuredClone(bundle);
  if(corruption==='unit')copy.values[0].unit='MG';
  if(corruption==='value')copy.values[0].value=999;
  if(corruption==='source')copy.evidence[0].sourceHash='0'.repeat(64);
  if(corruption==='locator')copy.evidence[0].locator.end=1;
  if(corruption==='missing')copy.values.pop();
  if(corruption==='rule')copy.facts[0].evidenceIds=['invented'];
  if(corruption==='duplicate')copy.foods.push(copy.foods[0]);
  assert.throws(()=>validateNutritionExpansion(copy),/INVALID/);
});
test('维生素B12不串入B1；B族分别返回，叶酸与DFE不合并',()=>{
  const b12=searchNutritionKnowledge(bundle,'维生素B12');assert.deepEqual(b12.nutrients.map(n=>n.id),['vitamin-b12']);
  const all=searchNutritionKnowledge(bundle,'维生素B族');assert(all.nutrients.some(n=>n.id==='biotin'));assert(all.nutrients.some(n=>n.id==='folate-total'));assert(all.nutrients.some(n=>n.id==='folate-dfe'));
  assert(!all.nutrients.some(n=>n.id==='vitamin-c'));
  assert.deepEqual(searchNutritionKnowledge(bundle,'叶酸DFE').nutrients.map(n=>n.id),['folate-dfe']);
  assert.deepEqual(searchNutritionKnowledge(bundle,'天然食物叶酸').nutrients.map(n=>n.id),['folate-food']);
});
test('食材形态检索：干香菇不返回鲜样本，普通香菇保留歧义；扁桃仁不等同杏核仁',()=>{
  const dry=searchNutritionKnowledge(bundle,'干香菇维生素D');assert.deepEqual(dry.foods.map(f=>f.food.id),['usda:168436']);
  assert.equal(dry.foods[0].values[0].value,3.9);assert.equal(dry.foods[0].foodFormConfirmed,false);
  const ambiguous=searchNutritionKnowledge(bundle,'香菇维生素D');assert.equal(ambiguous.foods.length,2);
  const comparison=searchNutritionKnowledge(bundle,'鲜香菇和干香菇维生素D');assert.equal(comparison.foods.length,2);
  assert(!bundle.foods.find(f=>f.fdcId==='170567')!.aliases.includes('杏仁'));
});
test('目标能量检索：能量原则和直接食物依据可追溯，条件未知不伪装为适用建议',()=>{
  const result=searchNutritionKnowledge(bundle,'增肌');assert(result.principles.some(p=>p.metricIds.includes('energy')&&p.applicability==='needs_confirmation'));
  assert(result.foods.length);assert(result.foods.some(f=>f.values.some(v=>v.unit==='KCAL')));
  assert(result.facts.every(f=>f.applicability==='needs_confirmation'));
  assert(result.evidence.length);assert.equal(result.clinicalRelease,null);
});
test('新病名不扩成一般贫血/所有脂肪肝，不从假设推断诊断',()=>{
  assert.equal(nutritionProfile(profile(),'如果我有便秘怎么办',bundle).conditions.length,0);
  assert.equal(nutritionProfile(profile(),'我有贫血',bundle).conditions.length,0);
  assert.equal(nutritionProfile(profile(),'我有脂肪肝',bundle).conditions.length,0);
  assert.equal(nutritionProfile(profile(),'我有缺铁性贫血',bundle).conditions[0],'缺铁性贫血');
});
test('GERD本人触发确认：番茄不泛化到柑橘；未知和否认均不触发少选',async()=>{
  const repo=provider(),input={profile:profile(['胃食管反流病']),content:constructedContent,conditions:{adult:'yes'}};
  let packet=await repo.prepare(input);assert(packet.guidance.filter(g=>g.factId.startsWith('nx-fact:gerd')).every(g=>g.applicability==='needs_confirmation'));
  packet=await repo.prepare({...input,currentText:'我已确认番茄诱发反流'});
  assert.equal(packet.guidance.find(g=>g.factId==='nx-fact:gerd-tomato')!.applicability,'applicable');
  assert.equal(packet.guidance.find(g=>g.factId==='nx-fact:gerd-citrus')!.applicability,'needs_confirmation');
  packet=await repo.prepare({...input,currentText:'我已确认番茄不诱发反流'});assert.equal(packet.guidance.find(g=>g.factId==='nx-fact:gerd-tomato')!.applicability,'not_applicable');
});
test('乳糖不耐：普通奶/豆奶不伪装无乳糖乳品，酸奶仍需耐受条件',async()=>{
  const content=contentContext({...constructedContent,foods:[...constructedContent.foods,{id:'ordinary-milk',name:'牛奶',aliases:['无乳糖牛奶'],unit:'ml',form:'liquid',allergens:['milk'],componentsComplete:true,nutrition:{}}]});
  const packet=await provider().prepare({profile:profile(['乳糖不耐受']),content,conditions:{adult:'yes'}});
  assert.equal(packet.guidance.find(g=>g.factId==='nx-fact:lactose-free')!.mapping.status,'unmapped');
  assert.equal(packet.guidance.find(g=>g.factId==='nx-fact:lactose-yogurt')!.applicability,'needs_confirmation');
});
test('增肌与恢复：有疾病不当作健康运动者；健康增重排查非自愿下降',async()=>{
  let packet=await provider().prepare({profile:profile(['慢性肾脏病'],['增肌','运动恢复']),content:constructedContent,conditions:{adult:'yes',healthyExerciser:'yes',resistanceTraining:'yes',exerciseTraining:'yes'}});
  assert(packet.guidance.filter(g=>g.factId.startsWith('nx-fact:muscle-gain')||g.factId.startsWith('nx-fact:exercise-recovery')).every(g=>g.applicability==='not_applicable'));
  packet=await provider().prepare({profile:profile([],['健康增重']),content:constructedContent,conditions:{adult:'yes',unintentionalWeightLoss:'yes'}});
  assert(packet.guidance.every(g=>g.applicability==='not_applicable'));
});
test('来源/限定/包撤回闭包，旧指纹失效且不会撤掉无关高血压资料',async()=>{
  const revoked=new Set<string>(),repo=provider(revoked),input={profile:profile(['高血压','便秘']),content:constructedContent,conditions:{adult:'yes'}};
  const first=await repo.prepare(input);await repo.assertCurrent(first);
  revoked.add('nx-ev:constipation-gradual');await assert.rejects(repo.assertCurrent(first),/CHANGED/);
  const second=await repo.prepare(input);assert(second.guidance.filter(g=>g.factId.startsWith('nx-fact:constipation')).every(g=>g.applicability==='withdrawn'));
  assert.equal(second.guidance.find(g=>g.factId==='fact:ht-limit-salt')!.applicability,'applicable');
  revoked.clear();revoked.add(bundle.id);const third=await repo.prepare(input);assert(third.guidance.filter(g=>g.factId.startsWith('nx-')).every(g=>g.applicability==='withdrawn'));
  const noComposition=searchNutritionKnowledge(bundle,'维生素C',{revoked:new Set(['usda-sr-2018'])});assert.equal(noComposition.foods.length,0);
});
test('新疾病指导绑定真实配料，营养数字不变成整菜达标或库存用量',async()=>{
  const packet=await provider().prepare({profile:profile(['便秘']),content:constructedContent,conditions:{adult:'yes'}});
  const recipe=simpleRecipe('西兰花测试菜',[['broccoli',1]]),variant=recipe.variants[0];
  const food=constructedContent.foods.find(f=>f.name==='西兰花');assert(food);variant.lines[0].foodId=food.id;
  const bound=bindRecipeGuidance(packet,constructedContent,recipe,variant);assert(bound.matches.some(m=>m.guidanceId==='guide:nx-fact:constipation-veg'));
  assert(!('nutritionValues' in packet));assert(!('calorieTarget' in packet));
});
test('新条件自然补问可以闭环，否认、后续覆盖与不清楚保留三态',async()=>{
  const repo=provider();let body:any={operationId:crypto.randomUUID(),messages:[{role:'user',content:'我是成年人，我有胃食管反流病'}],diseases:[],profile:profile()};
  let reply=await researchFoodChat(body,constructedContent,repo);
  assert(reply.assessment!.profile!.conditions.includes('胃食管反流病'));
  assert(reply.message.content.includes('还需确认：'));
  body={...body,profile:reply.assessment!.profile,messages:[...body.messages,reply.message,{role:'user',content:'是'}]};
  reply=await researchFoodChat(body,constructedContent,repo);
  assert(reply.researchGuidance!.guidance.some(g=>g.factId.startsWith('nx-fact:gerd')&&g.applicability==='applicable'));
  assert.equal(reportedConditions('我已确认番茄诱发反流','我已确认番茄不诱发反流').gerdTriggerTomato,'no');
  assert.equal(reportedConditions('如果我已确认番茄诱发反流').gerdTriggerTomato,undefined);
  assert.equal(reportedConditions('我已确认番茄诱发反流','我不清楚是否已确认番茄诱发反流').gerdTriggerTomato,'unknown');
});
test('本地PG兼容存储：幂等/读回/SQL检索/不可变/源撤回（PGlite，不冒充真实PG）',async()=>{
  const engine=new PGlite(),db:Database={query:async(sql,params)=>{const r=await engine.query(sql,params);return {rows:r.rows as any[]};},exec:async sql=>{await engine.exec(sql);},close:async()=>engine.close()};
  try{
    const first=await persistNutritionExpansion(db,bundle),second=await persistNutritionExpansion(db,bundle);
    assert(first.imported);assert(!second.imported);assert.equal(second.compositionRows,bundle.values.length);
    assert.equal(canonicalKnowledgeHash(await loadNutritionExpansion(db)),canonicalKnowledgeHash(bundle));
    const result=await queryLocalNutritionKnowledge(db,'生西兰花维生素C');assert.equal(result.foods[0].values[0].value,89.2);
    await assert.rejects(db.query('UPDATE health_kb.nutrition_composition SET value=999 WHERE bundle_id=$1',[bundle.id]));
    const changed=structuredClone(bundle);changed.facts[0].statement+=' 变更';await assert.rejects(persistNutritionExpansion(db,changed),/IMMUTABLE/);
    await db.query('INSERT INTO health_kb.health_revocations(target_id,reason) VALUES($1,$2)',['usda-sr-2018','synthetic isolated database test']);
    assert.equal((await queryLocalNutritionKnowledge(db,'维生素C')).foods.length,0);
  }finally{await db.close();}
});
