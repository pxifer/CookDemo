import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contentContext } from '../shared/content';
import { constructedContent } from '../shared/catalog';
import { readFoodGuidanceAssets } from '../backend/src/rag/food-guidance-repository';
import { bindRecipeGuidance, createFoodGuidanceProvider, guidanceProfile, guidanceReason, reportedConditions } from '../backend/src/rag/food-guidance';
import { researchFoodChat } from '../backend/src/rag/food-guidance-chat';
import { simpleRecipe } from './fixtures';
const assets=await readFoodGuidanceAssets();
const provider=(revoked=new Set<string>())=>createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set(revoked));
const profile=(conditions:string[]=[],goals:string[]=[])=>({conditions,goals,notes:''});
const cases=JSON.parse(await readFile('datasets/evaluation/business-rag-cases-v1.json','utf8')).cases;
for(const item of cases)test(`本餐指导数据规范：${item.id}（项目构造${item.split}，非独立人审）`,async()=>{
  const packet=await provider().prepare({profile:profile(item.conditions,item.goals),content:constructedContent,conditions:item.context});
  if(item.expected.factId){const row=packet.guidance.find(g=>g.factId===item.expected.factId);assert(row,item.expected.factId);for(const key of ['direction','objectId','applicability'])if(item.expected[key])assert.equal((row as any)[key],item.expected[key]);}
  if(item.expected.noDiseaseTopic)assert(!packet.topics.some(t=>t.kind==='condition'));
  if(item.expected.uncoveredTopic)assert(packet.uncoveredTopics.includes(item.expected.uncoveredTopic));
  for(const g of packet.guidance.filter(g=>g.applicability==='applicable'))for(const id of [...g.evidenceIds,...g.qualifyingEvidenceIds])assert(packet.evidence.some(e=>e.id===id));
});
test('指导映射：普通鸡肉/猪肉的别名不能证明去皮/瘦肉，普通牛奶不能证明低脂',async()=>{
  const content=contentContext({...constructedContent,foods:[...constructedContent.foods,{id:'milk-fixture',name:'牛奶',aliases:['低脂奶'],unit:'ml',form:'liquid',allergens:['milk'],componentsComplete:true,nutrition:{}}]});
  const packet=await provider().prepare({profile:profile(['高脂血症']),content,conditions:{adult:'yes'}});
  assert.deepEqual(packet.guidance.find(g=>g.objectId==='f:skinless-poultry')!.mapping.foodIds,[]);
  assert.deepEqual(packet.guidance.find(g=>g.objectId==='f:lean-meat')!.mapping.foodIds,[]);
  assert.deepEqual(packet.guidance.find(g=>g.objectId==='f:low-fat-milk')!.mapping.foodIds,[]);
});
test('配方绑定：主做法与实际配料、可省项、变体版本分别核对，不凭菜名/否定句/备选方法判断',async()=>{
  const p=await provider().prepare({profile:profile([],['减脂','增肌']),content:constructedContent,conditions:{adult:'yes',healthyExerciser:'yes',resistanceTraining:'yes'}});
  const recipe=simpleRecipe('清蒸鸡蛋',[['egg',1]]),v=recipe.variants[0];v.steps=['放入蒸锅，蒸至熟透。'];v.methodOptions=[{label:'备选炸法',steps:['下油锅炸至金黄']}];
  const proof=bindRecipeGuidance(p,constructedContent,recipe,v);assert(proof.matches.some(m=>m.processRule==='steam-boil-primary'));assert(!proof.matches.some(m=>m.processRule==='fry-primary'));
  const fried={...v,steps:['煎至两面金黄。']};assert(bindRecipeGuidance(p,constructedContent,recipe,fried).matches.some(m=>m.processRule==='fry-primary'));
  const negated={...v,steps:['不要油炸，也不要煎至焦黄。']};assert(!bindRecipeGuidance(p,constructedContent,recipe,negated).matches.some(m=>m.processRule));
  const omitted=bindRecipeGuidance(p,constructedContent,recipe,v,['鸡蛋']);assert(!omitted.matches.some(m=>m.foodIds.includes('egg')));
  assert.notEqual(bindRecipeGuidance(p,constructedContent,recipe,fried).recipeHash,proof.recipeHash);
  assert.throws(()=>guidanceReason(p,proof,['guide:invented']),/INVALID/);
});
test('撤回：来源、限定证据、事实、目标快照均失效，旧水位不能发布；其他主题不被全局误撤回',async()=>{
  const revoked=new Set<string>(),repo=provider(revoked),input={profile:profile(['高血压'],['增肌']),content:constructedContent,conditions:{adult:'yes'}};
  const p=await repo.prepare(input);revoked.add(assets.goals.id);await assert.rejects(repo.assertCurrent(p),/CHANGED/);
  const next=await repo.prepare(input);assert(next.guidance.filter(g=>g.topic.kind==='goal').every(g=>g.applicability==='withdrawn'));assert.equal(next.guidance.find(g=>g.factId==='fact:ht-limit-salt')!.applicability,'applicable');
  revoked.clear();revoked.add('goal-ev:exercise-scope');assert((await repo.prepare({...input,profile:profile([],['增肌'])})).guidance.every(g=>g.applicability==='withdrawn'));
});
test('用户条件：只采明确自述，不从目标/疾病名称默认成人、健康或无并发症，不从假设恢复疾病',()=>{
  assert.deepEqual(reportedConditions('想增肌，成人高血压'),{});
  assert.equal(reportedConditions('我没有肾病').renalFunction,undefined);
  assert.equal(reportedConditions('我身体健康','我不清楚是否健康').healthyExerciser,'unknown');
  assert.equal(reportedConditions('我未成年','我已成年').adult,'yes');
  assert.equal(reportedConditions('我今年16岁').adult,'no');
  assert.deepEqual(reportedConditions('我是成年人；我身体健康；我规律抗阻训练'),{adult:'yes',healthyExerciser:'yes',resistanceTraining:'yes'});
  assert.equal(guidanceProfile(profile(),'如果我有高血压怎么办',assets.bundle,assets.goals).conditions.length,0);
  assert.equal(guidanceProfile(profile(),'我想减脂',assets.bundle,assets.goals).goals[0],'减脂');
});
test('研究食材建议使用原始指导与当前自述，返回无调用凭证，不在资料不足时伪装模型回复',async()=>{
  const reply=await researchFoodChat({operationId:crypto.randomUUID(),messages:[{role:'user',content:'我是成年人，我身体健康，我规律抗阻训练，我想增肌'}],diseases:[],profile:profile(),mealContext:{ingredients:['鸡蛋'],seasonings:[],restrictions:['花生'],allowBuy:false}},constructedContent,provider());
  assert.equal(reply.knowledge,'research_rag');assert(!reply.invocation);assert(reply.assessment!.suggestions.some(s=>s.foodName==='鸡蛋'&&s.direction==='prefer'));assert(reply.researchGuidance!.evidence.some(e=>e.id==='goal-ev:exercise-scope'));
  const missing=await researchFoodChat({operationId:crypto.randomUUID(),messages:[{role:'user',content:'我想增肌'}],diseases:[]},constructedContent,provider());assert.equal(missing.assessment!.stage,'clarify');assert.equal(missing.assessment!.suggestions.length,0);
});
test('自然补问按当前问题理解“是”，不将一次肯定扩大到所有条件，也不无限重复提问',async()=>{
  const request={operationId:crypto.randomUUID(),messages:[{role:'user' as const,content:'我想增肌'}],diseases:[],profile:profile()};
  const repo=provider();let body:any=request;let reply=await researchFoodChat(body,constructedContent,repo);
  for(const label of ['是否为成年人','是否属于无已知疾病的健康运动人群','是否进行抗阻/力量训练']){
    assert(reply.message.content.includes(label));
    body={...body,profile:reply.assessment!.profile,messages:[...body.messages,reply.message,{role:'user',content:'是'}]};
    reply=await researchFoodChat(body,constructedContent,repo);
  }
  assert.equal(reply.assessment!.stage,'advice');assert(reply.assessment!.suggestions.some(s=>s.foodName==='鸡蛋'));assert.equal(reply.researchGuidance!.missingConditions.length,0);
});
