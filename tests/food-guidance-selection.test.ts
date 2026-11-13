import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createHealthRecipeSelector } from '../backend/src/health-recipe-selection';
import { readFoodGuidanceAssets } from '../backend/src/rag/food-guidance-repository';
import { createFoodGuidanceProvider } from '../backend/src/rag/food-guidance';
import { constructedContent } from '../shared/catalog';
import { contentContext } from '../shared/content';
import { extractText } from '../shared/extraction';
import { mealWith,request,simpleRecipe } from './fixtures';
import type { Meal,Recipe } from '../shared/types';
const assets=await readFoodGuidanceAssets();
const repo=(revoked=new Set<string>())=>createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set(revoked));
const base=():Meal=>({...mealWith('鸡蛋5个西红柿600g花生100g'),health:true,composition:'custom',counts:{meat:0,veg:1,soup:0},healthProfile:{conditions:[],goals:['增肌'],notes:'我是成年人；我身体健康；我规律抗阻训练',suggestions:[],updatedAt:'2026-11-04'}});
const envelope=(content:unknown)=>Response.json({id:'research-fixture-call-only-123',model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:40,total_tokens:140},choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]});
const input=(meal:Meal,recipes:Recipe[],fetcher:typeof fetch)=>({request:request(meal),owner:'research-owner',apiKey:'synthetic-contract-key-not-real',context:contentContext({...constructedContent,recipes,contentVersion:'recipe-guidance-fixture-v1'}),signal:AbortSignal.timeout(15000),fetcher,present:(dish:any)=>dish,claim:async()=>{},progress:()=>{}});
const selection=(p:any)=>({summary:'模型可能写的疗效不进入最终健康理由',choices:[{id:p.catalog.find((c:any)=>c.guidanceIds.length).id,reason:'此处为构造模型文本，最终由程序生成理由',guidanceIds:p.catalog.find((c:any)=>c.guidanceIds.length).guidanceIds.slice(0,3)}]});
test('本餐RAG：真实配料/主做法与原文限定进入选菜，程序生成有依据的理由，不发布模型自由疗效',async()=>{
  let calls=0;const recipes=[simpleRecipe('egg',[['egg',1]]),simpleRecipe('tomato',[['tomato',100]])];recipes[0].variants[0].steps=['放入蒸锅蒸至熟透'];
  const start=input(base(),recipes,async(_url,init)=>{calls++;const body=JSON.parse(String(init?.body)),p=JSON.parse(body.messages[1].content);assert(p.evidenceGuidance.evidence.some((e:any)=>e.id==='goal-ev:exercise-scope'));assert(body.messages[0].content.includes('guidanceIds'));return envelope(selection(p));});
  const result=await createHealthRecipeSelector(randomBytes(32),repo())(start);
  assert.equal(calls,1);assert.equal(result.status,'completed');assert.equal(result.dishes[0].recipe.id,'egg');assert.match(result.dishes[0].aiReason!,/增肌/);assert(!result.dishes[0].aiReason!.includes('模型可能'));assert(result.dishes[0].aiGrounding!.matches.some(m=>m.foodIds.includes('egg')));assert.equal(result.researchGuidance?.clinicalRelease,null);
});
test('硬限制优先，程序给真实配方绑定依据；模型填写的伪造引用不会被发布',async()=>{
  const meal=base();meal.restrictions=extractText('花生过敏').restrictions.map(r=>({...r,status:'confirmed' as const}));meal.aiFoodChoices={preferred:[],limited:[],excluded:['西红柿']};
  const recipes=[simpleRecipe('egg',[['egg',1]]),simpleRecipe('peanut',[['peanut',10]]),simpleRecipe('tomato',[['tomato',100]]),simpleRecipe('missing-beef',[['beef',100]])];
  let calls=0;const start=input(meal,recipes,async(_u,init)=>{calls++;const p=JSON.parse(JSON.parse(String(init?.body)).messages[1].content);assert.deepEqual(p.catalog.map((c:any)=>c.name),['egg']);return envelope({...selection(p),choices:[{id:p.catalog[0].id,reason:'构造',guidanceIds:['guide:invented']}]});});
  const result=await createHealthRecipeSelector(randomBytes(32),repo())(start);assert.equal(calls,1);assert.equal(result.status,'completed');assert(!JSON.stringify(result).includes('guide:invented'));assert(result.dishes[0].aiGrounding!.matches.some(m=>m.foodIds.includes('egg')));
});

test('模型仍只能选择提供的目录ID，程序绑定不允许伪造菜谱或重复父菜',async()=>{
  let calls=0;const start=input(base(),[simpleRecipe('egg',[['egg',1]])],async()=>{calls++;return envelope({summary:'构造目录外ID',choices:[{id:'not-in-catalog',reason:'构造'}]});});
  await assert.rejects(createHealthRecipeSelector(randomBytes(32),repo())(start),/未通过/);assert.equal(calls,1);
});
test('未知条件或未匹配依据只保留健康判断，正常本餐仍交给模型选择，不伪装有依据',async()=>{
  for(const meal of [{...base(),healthProfile:{...base().healthProfile!,notes:''}},{...base(),healthProfile:{...base().healthProfile!,conditions:['慢性肾病']}},base()]){
    let calls=0;const result=await createHealthRecipeSelector(randomBytes(32),repo())(input(meal,[simpleRecipe('tomato',[['tomato',100]])],async(_u,init)=>{calls++;const p=JSON.parse(JSON.parse(String(init?.body)).messages[1].content);return envelope({summary:'只按本餐条件选择，不作健康结论',choices:[{id:p.catalog[0].id,reason:'复用现有食材',guidanceIds:[]}]});}));
    assert.equal(calls,1);assert.equal(result.status,'completed');assert.equal(result.researchGuidance?.coverage,'unmatched');assert.equal(result.dishes[0].aiGrounding!.matches.length,0);assert.match(result.dishes[0].aiReason!,/未形成.*健康适宜性结论/);assert.match(result.healthAssessment!.message,/未作.*适宜性结论/);
  }
});
test('少选不是硬禁：减脂含糖候选保留但明确提示，不能以含白糖宣称整菜高糖',async()=>{
  const meal={...base(),healthProfile:{...base().healthProfile!,goals:['减脂'],notes:'我是成年人'}};
  const recipe=simpleRecipe('sweet-egg',[['egg',1],['sugar',1]]);
  recipe.variants[0].lines[1].role='seasoning';
  const result=await createHealthRecipeSelector(randomBytes(32),repo())(input(meal,[recipe],async(_u,init)=>envelope(selection(JSON.parse(JSON.parse(String(init?.body)).messages[1].content)))));
  assert.equal(result.status,'completed');assert.match(result.dishes[0].aiReason!,/少选项白糖/);assert(!result.dishes[0].aiReason!.includes('整菜高糖'));
});

test('真实预览回归：不能因油量未知/没有证据拒绝唯一合格菜，空选择不冒充没有可做菜',async()=>{
  const meal={...base(),healthProfile:{...base().healthProfile!,goals:['减脂'],notes:'我是成年人'}};let calls=0;
  await assert.rejects(createHealthRecipeSelector(randomBytes(32),repo())(input(meal,[simpleRecipe('plain-tomato',[['tomato',100]])],async(_u,init)=>{
    calls++;const body=JSON.parse(String(init?.body));assert(body.messages[0].content.includes('少选不是避开'));assert(body.messages[0].content.includes('不得默认超标'));
    return envelope({summary:'油量未知所以与减脂冲突，因此不选',choices:[]});
  })),/存在.*合格.*未完成选择/);assert.equal(calls,1);
});
test('撤回发生在生成期间时丢弃回答；翻页水位变化使旧游标失效且不额外调用',async()=>{
  const withdrawn=new Set<string>(),p=repo(withdrawn),selector=createHealthRecipeSelector(randomBytes(32),p);let calls=0;
  const start=input(base(),[simpleRecipe('egg',[['egg',1]])],async(_u,init)=>{calls++;withdrawn.add('goal-ev:exercise-scope');return envelope(selection(JSON.parse(JSON.parse(String(init?.body)).messages[1].content)));});
  await assert.rejects(selector(start),/依据已变化/);assert.equal(calls,1);
});
test('分页与手选口味重新核对配方，无新增模型调用；知识/目录变化不能复用旧游标',async()=>{
  const meal={...base(),allowBuy:true,mode:'candidates' as const,composition:'auto' as const};
  const recipes=Array.from({length:8},(_,i)=>simpleRecipe('egg-'+i,[['egg',1]]));for(const r of recipes)r.variants.push({...r.variants[0],id:r.id+'-other',flavor:'微辣',steps:['煎至熟透']});
  let calls=0;const revoked=new Set<string>(),selector=createHealthRecipeSelector(randomBytes(32),repo(revoked));
  const start=input(meal,recipes,async(_u,init)=>{calls++;const p=JSON.parse(JSON.parse(String(init?.body)).messages[1].content);return envelope({summary:'构造8候选',choices:p.catalog.slice(0,p.count).map((c:any)=>({id:c.id,reason:'构造',guidanceIds:c.guidanceIds.slice(0,3)}))});});
  const first=await selector(start);assert.equal(first.total,first.dishes.length);
  const page=await selector({...start,request:request(meal,{action:'page',page:0,cursor:first.cursor})});assert.equal(page.dishes.length,first.dishes.length);assert.equal(calls,1);
  const chosen=first.dishes[0];const changed=await selector({...start,request:request({...meal,overrides:{[chosen.recipe.id]:chosen.recipe.id+'-other'}},{action:'variant',cursor:first.cursor,selected:first.dishes.map(d=>({recipeId:d.recipe.id,variantId:d.variant.id}))})});
  assert.equal(changed.dishes[0].aiGrounding!.variantId,chosen.recipe.id+'-other');assert.equal(calls,1);
  revoked.add('goal-ev:exercise-scope');await assert.rejects(selector({...start,request:request(meal,{action:'page',page:1,cursor:first.cursor})}),/过期/);assert.equal(calls,1);
});
