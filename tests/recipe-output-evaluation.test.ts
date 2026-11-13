import test from 'node:test';
import assert from 'node:assert/strict';
import {readOutputDataset,readOutputLabels,outputInferenceInput,outputMeal,scoreOutput,validateHumanReview,type OutputCase} from '../scripts/lib/recipe-output-evaluation';
import {constructedContent} from '../shared/catalog';
import {simpleRecipe} from './fixtures';
import type {RecommendationResult} from '../shared/types';
import {createFoodGuidanceProvider,bindRecipeGuidance} from '../backend/src/rag/food-guidance';
import {readFoodGuidanceAssets} from '../backend/src/rag/food-guidance-repository';
import {createHealthRecipeSelector} from '../backend/src/health-recipe-selection';
import {contentContext} from '../shared/content';
import {mealWith,request} from './fixtures';

test('评测输入与期望分离，48个固定题一一对应；嵌套答案字段不能进入推理',async()=>{
 const dataset=await readOutputDataset(),labels=await readOutputLabels();
 const fixed=dataset.cases.filter(c=>!c.id.startsWith('custom-'));assert.equal(fixed.length,48);assert(fixed.some(c=>c.task==='open_input'&&c.input.userText?.includes('北京天气')));assert.deepEqual(fixed.map(c=>c.id).sort(),Object.keys(labels.labels).filter(k=>!k.startsWith('custom-')).sort());
 for(const item of dataset.cases){assert.deepEqual(outputInferenceInput(item),item.input);assert(!JSON.stringify(outputInferenceInput(item)).includes('factId'));}
 const tainted=structuredClone(dataset.cases[0]);(tainted.input as any).nested={gold:'bad'};assert.throws(()=>outputInferenceInput(tainted),/LABEL_LEAK/);
});

const item:OutputCase={id:'scorer-negative',title:'构造评分反例',task:'meal',family:'negative',split:'development',input:{profile:{conditions:[],goals:[],notes:''},ingredients:'鸡蛋',allowBuy:false,allergies:['鸡蛋'],counts:{meat:0,veg:1,soup:0}}};
test('评分器拒绝目录外ID和过敏；即使预期终态正确也不能用均分抵消硬失败',()=>{
 const ctx=outputMeal(item,constructedContent),recipe=simpleRecipe('构造蛋菜',[['egg',1]]),variant=recipe.variants[0];
 const result={status:'completed',dishes:[{recipe,variant,omitted:[],checks:[],reused:['egg'],nutrition:{kcal:null,protein:null,sodium:null}}]} as unknown as RecommendationResult;
 const score=scoreOutput(item,{status:'completed'},{result,attempts:1},ctx);
 assert(score.hardFailures.includes('allergy_or_avoid_violated'));assert(score.hardFailures.includes('non_catalog_or_duplicate_parent'));assert.equal(score.functionalPass,false);assert.equal(score.effectivePass,null);assert.equal(score.humanScore,null);
});

test('未运行不算满分、未评分不算0或满分，人工记录保留角色与非独立状态',()=>{
 const score=scoreOutput(item,{status:'completed'},{attempts:0,error:'not_run'});assert.equal(score.engineeringScore,0);assert.equal(score.functionalPass,false);
 assert.throws(()=>validateHumanReview({reviewer:'test',scores:{},criticalFailures:[],comment:'未评分'}),/INVALID/);
 const review=validateHumanReview({reviewer:'human-test',role:'user_product_review',scores:{goalFit:3,reasonSupport:2,conditionsAndUnknowns:3,actionability:4,clarity:4},criticalFailures:[],comment:'构造记录，不是真实人审'});
 assert.equal(review.score,80);assert.equal(review.independent,false);assert.equal(review.professionalIdentityVerified,false);
});

test('结构化库存评测保留未知完整名称；用量不同仍给相同已确认食材',()=>{
 const unknown=outputMeal({...item,input:{...item.input,ingredients:'宇宙菠菜',allergies:[]}},constructedContent).meal;
 assert.equal(unknown.ingredients.length,1);assert.equal(unknown.ingredients[0].foodId,null);assert.equal(unknown.ingredients[0].status,'pending');assert.equal(unknown.ingredients[0].name,'宇宙菠菜');
 const small=outputMeal({...item,input:{...item.input,ingredients:'鸡蛋1g',allergies:[]}},constructedContent).meal;
 const large=outputMeal({...item,input:{...item.input,ingredients:'鸡蛋99999g',allergies:[]}},constructedContent).meal;
 assert.equal(small.ingredients[0].foodId,large.ingredients[0].foodId);assert.equal(small.ingredients[0].amount,'');assert.equal(large.ingredients[0].amount,'');
});

test('真实失败回归：配菜煮熟留用后主菜煸炒油焖，不能绑定蒸煮主做法',async()=>{
 const assets=await readFoodGuidanceAssets(),provider=createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set());
 const recipe=simpleRecipe('不凭菜名判主做法',[['egg',1]]),content=contentContext({...constructedContent,recipes:[recipe]});
 const packet=await provider.prepare({profile:{conditions:[],goals:['减脂'],notes:'我是成年人'},content});
 recipe.variants[0].steps=['豌豆煮熟留用。','热锅热油煸炒主料，添少许水油焖，翻匀即可。'];
 assert(!bindRecipeGuidance(packet,content,recipe,recipe.variants[0]).matches.some(m=>m.processRule==='steam-boil-primary'));
 recipe.variants[0].steps=['主料放入蒸锅蒸至熟透。'];
 assert(bindRecipeGuidance(packet,content,recipe,recipe.variants[0]).matches.some(m=>m.processRule==='steam-boil-primary'));
});

test('真实失败回归：自定义一道菜不携带六道下限；供选目录每道复用现有主料',async()=>{
 const meal={...mealWith('鸡蛋'),health:true,allowBuy:true,composition:'custom' as const,counts:{meat:0,veg:1,soup:0}};
 const recipes=[simpleRecipe('可复用',[['egg',1]]),simpleRecipe('不能只买新主料',[['beef',1]])];
 const result=await createHealthRecipeSelector(Buffer.alloc(32,3))({request:request(meal),owner:'fixture',apiKey:'not-a-real-key',context:contentContext({...constructedContent,recipes}),signal:AbortSignal.timeout(10000),present:d=>d,claim:async()=>{},progress:()=>{},fetcher:async(_u,init)=>{
  const packet=JSON.parse(JSON.parse(String(init?.body)).messages[1].content);assert.equal(packet.min,1);assert.equal(packet.max,1);assert.equal(packet.count,1);assert.equal(packet.catalog.length,1);assert.equal(packet.catalog[0].name,'可复用');
  return Response.json({id:'fixture-repaired-count-123',model:'deepseek-flash',usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2},choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'只选一道',choices:[{id:packet.catalog[0].id,reason:'复用已有鸡蛋'}]})}}]});
 }});
 assert.equal(result.status,'completed');assert.equal(result.dishes.length,1);
});

test('库外主题、缺少适用条件与已知不适用分开；糖尿病不默认2型',async()=>{
 const assets=await readFoodGuidanceAssets(),provider=createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set());
 const prepare=(conditions:string[],goals:string[],context:Record<string,string>={})=>provider.prepare({profile:{conditions,goals,notes:''},conditions:context,content:constructedContent});
 const unknown=await prepare(['甲减'],[]);assert.equal(unknown.topicCoverage?.find(t=>t.input==='condition:甲减')?.status,'knowledge_gap');
 const missing=await prepare([],['增肌'],{adult:'yes',healthyExerciser:'yes'});assert.equal(missing.topicCoverage?.find(t=>t.input==='goal:增肌')?.status,'missing_conditions');
 const contraindicated=await prepare(['慢性肾病'],['增肌'],{adult:'yes',resistanceTraining:'yes'});assert.equal(contraindicated.topicCoverage?.find(t=>t.input==='goal:增肌')?.status,'not_applicable');
 const subtype=await prepare(['糖尿病'],[]);assert.equal(subtype.topicCoverage?.[0].status,'needs_topic_detail');assert(subtype.missingConditions.includes('diabetesType'));assert(!subtype.guidance.some(g=>g.topic.id==='d:type2-diabetes'));
});

test('评分不因菜谱ID正确就放过伪造指导或缺失限定证据',async()=>{
 const assets=await readFoodGuidanceAssets(),provider=createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set());
 const recipe=simpleRecipe('真实目录菜',[['egg',1]]);recipe.variants[0].steps=['放入蒸锅蒸至熟透'];
 const snapshot={...constructedContent,recipes:[recipe]},example={...item,input:{...item.input,allergies:[],profile:{conditions:[],goals:['减脂'],notes:'我是成年人'}}};
 const ctx=outputMeal(example,snapshot),packet=await provider.prepare({profile:example.input.profile,content:ctx.content}),binding=bindRecipeGuidance(packet,ctx.content,recipe,recipe.variants[0]);
 const result={status:'completed',dishes:[{recipe,variant:recipe.variants[0],omitted:[],checks:[],reused:['egg'],nutrition:{kcal:null,protein:null,sodium:null},aiGrounding:binding}]} as unknown as RecommendationResult;
 assert.equal(scoreOutput(example,{status:'completed'},{result,packet,attempts:1},ctx).functionalPass,true);
 const forged=structuredClone(result);forged.dishes[0].aiGrounding!.matches[0].guidanceId='invented';
 assert(scoreOutput(example,{status:'completed'},{result:forged,packet,attempts:1},ctx).hardFailures.includes('invented_inapplicable_or_incomplete_guidance'));
 assert(scoreOutput(example,{status:'completed'},{result,packet:{...packet,evidence:[]},attempts:1},ctx).hardFailures.includes('invented_inapplicable_or_incomplete_guidance'));
});

test('独立评委m07回归：宽泛猪肉库存不宣称已有五花肉馅，普通任务不附健康模板',async()=>{
 const assets=await readFoodGuidanceAssets(),provider=createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set());
 const mince={...constructedContent.foods.find(f=>f.id==='pork')!,id:'specific-pork-mince',name:'五花肉馅',aliases:[]};
 const recipe=simpleRecipe('蒸肉饼',[['specific-pork-mince',100]],{category:'meat'});recipe.variants[0].steps=['放入蒸锅蒸至熟透。'];
 const snapshot={...constructedContent,foods:[...constructedContent.foods,mince],recipes:[recipe]};
 const ctx=outputMeal({...item,input:{profile:{conditions:[],goals:[],notes:''},ingredients:'猪肉',allowBuy:false,counts:{meat:1,veg:0,soup:0}}},snapshot);
 const result=await createHealthRecipeSelector(Buffer.alloc(32,4),provider)({request:request(ctx.meal),owner:'judge-regression',apiKey:'fixture-only-key',context:ctx.content,signal:AbortSignal.timeout(10000),present:d=>d,claim:async()=>{},progress:()=>{},fetcher:async(_u,init)=>{
  const packet=JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
  return Response.json({id:'fixture-judge-pantry-123',model:'deepseek-flash',usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2},choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'构造回复',choices:[{id:packet.catalog[0].id,reason:'构造理由'}]})}}]});
 }});
 assert.equal(result.status,'completed');assert.match(result.dishes[0].aiReason!,/用上现有猪肉/);assert(!result.dishes[0].aiReason!.includes('现有五花肉馅'));
 assert.match(result.dishes[0].aiReason!,/配方需五花肉馅.*待确认/);assert(result.dishes[0].aiBasis!.includes('复用本餐食材：猪肉'));
 assert(!/健康|适宜性|疾病/.test(result.healthAssessment!.message));assert(!/健康|适宜性/.test(result.dishes[0].aiReason!));
});

test('独立评委q20回归：明确过敏冲突才解释排除，不调用模型且不建议放宽过敏',async()=>{
 const assets=await readFoodGuidanceAssets(),provider=createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set());
 const recipe=simpleRecipe('白菜豆腐汤',[['cabbage',100],['tofu',100]],{category:'soup'});
 const ctx=outputMeal({...item,input:{profile:{conditions:[],goals:[],notes:''},ingredients:'白菜、豆腐',allergies:['豆腐'],allowBuy:false,counts:{meat:0,veg:0,soup:1}}},{...constructedContent,recipes:[recipe]});
 let calls=0;const result=await createHealthRecipeSelector(Buffer.alloc(32,5),provider)({request:request(ctx.meal),owner:'judge-regression',apiKey:'fixture-only-key',context:ctx.content,signal:AbortSignal.timeout(10000),present:d=>d,claim:async()=>{},progress:()=>{},fetcher:async()=>{calls++;throw Error('must not call');}});
 assert.equal(result.status,'no_results');assert.equal(calls,0);assert.equal(result.dishes.length,0);assert.match(result.reasons.join(''),/过敏食材（豆腐）.*已排除/);assert.match(result.reasons.join(''),/不会放宽过敏/);
 assert.deepEqual(ctx.meal.restrictions.map(r=>r.name),['豆腐']);
});

test('缺食材或类别不符不能归因为过敏；诊断不改变候选资格',async()=>{
 const recipe=simpleRecipe('鸡蛋菜',[['egg',1]],{category:'veg'});
 for(const counts of [{meat:0,veg:1,soup:0},{meat:0,veg:0,soup:1}]){
  const ctx=outputMeal({...item,input:{profile:{conditions:[],goals:[],notes:''},ingredients:'白菜',allergies:['豆腐'],allowBuy:false,counts}},{...constructedContent,recipes:[recipe]});
  const result=await createHealthRecipeSelector(Buffer.alloc(32,6))({request:request(ctx.meal),owner:'judge-regression',apiKey:'fixture-only-key',context:ctx.content,signal:AbortSignal.timeout(10000),present:d=>d,claim:async()=>{},progress:()=>{},fetcher:async()=>{throw Error('must not call');}});
  assert.equal(result.status,'no_results');assert(!result.reasons.join('').includes('过敏食材'));assert.equal(result.dishes.length,0);
 }
});
