import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createHealthRecipeSelector } from '../backend/src/health-recipe-selection';
import { constructedContent } from '../shared/catalog';
import { mealWith, request, simpleRecipe } from './fixtures';
import { createApp } from '../backend/src/app';
import { fixture } from './registration-fixture';
import type { Meal } from '../shared/types';

const apiKey='sk-recipe-test-only-123456789012345';
const envelope=(content:unknown)=>Response.json({id:'recipe-call-proof-12345678',model:'deepseek-flash',usage:{prompt_tokens:80,completion_tokens:40,total_tokens:120},choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]});
const context=(recipes:ReturnType<typeof simpleRecipe>[])=>({...constructedContent,recipes,contentVersion:'ai-recipe-fixture-v1'});
const oneMeal=()=>({...mealWith('西红柿600g鸡蛋5个'),health:true,composition:'custom' as const,counts:{meat:0,veg:1,soup:0}});
const options=(meal:Meal,recipes:ReturnType<typeof simpleRecipe>[],fetcher:typeof fetch)=>({request:request(meal),owner:'owner-a',apiKey,context:context(recipes),signal:new AbortController().signal,fetcher,present:(dish:any)=>dish,claim:async()=>{},progress:()=>{}});

test('AI读取档案、已接受食材、食材有无、调料检查、补买及实际做法，模型指定菜品成为结果',async()=>{
  const meal=oneMeal();meal.healthProfile={conditions:['构造健康关注'],goals:['增肌'],notes:'自述测试',suggestions:[],updatedAt:'2026-10-28'};meal.aiFoodPreferences={preferred:['鸡蛋'],limited:[],excluded:[]};
  const recipes=[simpleRecipe('tomato',[['tomato',100]]),simpleRecipe('egg',[['egg',1]])];recipes[1].variants[0].steps=['蒸至熟透，按原菜谱操作'];
  let called=0,claimed=0;
  const input=options(meal,recipes,async(url,init)=>{
    called++;assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(new Headers(init?.headers).get('authorization'),`Bearer ${apiKey}`);
    const body=JSON.parse(String(init?.body)),packet=JSON.parse(body.messages.at(-1).content);
    assert.equal(packet.user.ingredients[0].amount,'');assert.deepEqual(packet.user.healthProfile.conditions,['构造健康关注']);assert.deepEqual(packet.user.accepted.preferred,['鸡蛋']);assert.equal(packet.user.allowBuy,false);assert.equal(packet.user.checkSeasonings,false);assert(packet.user.seasonings.length);
    const chosen=packet.catalog.find((item:any)=>item.name==='egg');assert(chosen.steps.includes('蒸至熟透，按原菜谱操作'));assert(chosen.ingredients.some((item:any)=>item.name==='鸡蛋'));
    return envelope({summary:'构造搭配说明',choices:[{id:chosen.id,reason:'模型明确选择鸡蛋菜，复用库存并采用已给做法。'}]});
  });input.claim=async()=>{claimed++;};
  const result=await createHealthRecipeSelector(randomBytes(32))(input);
  assert.deepEqual(result.dishes.map(dish=>dish.recipe.id),['egg']);assert.match(result.dishes[0].aiReason!,/模型明确选择/);assert.equal(result.healthAssessment?.state,'model_selected');assert.equal(called,1);assert.equal(claimed,1);
});

test('过敏、AI已接受避开及不补买不能被模型绕过，填写用量不拦截多菜，非法ID/重复选择/断连不回退普通推荐',async()=>{
  const meal=oneMeal();meal.aiFoodPreferences={preferred:[],limited:[],excluded:['花生']};
  const recipes=[simpleRecipe('tomato-a',[['tomato',400]]),simpleRecipe('tomato-b',[['tomato',400]]),simpleRecipe('peanut',[['peanut',10]]),simpleRecipe('beef',[['beef',100]])];
  let calls=0;
  const base=options(meal,recipes,async(_url,init)=>{calls++;const packet=JSON.parse(JSON.parse(String(init?.body)).messages.at(-1).content);assert(!packet.catalog.some((item:any)=>['peanut','beef'].includes(item.name)));return envelope({summary:'构造',choices:[{id:'invented',reason:'编造'}]});});
  await assert.rejects(createHealthRecipeSelector(randomBytes(32))(base),/未通过/);assert.equal(calls,1);
  base.fetcher=async()=>{calls++;throw Error('private upstream '+apiKey);};await assert.rejects(createHealthRecipeSelector(randomBytes(32))(base),error=>!/sk-recipe/.test(String(error)));assert.equal(calls,2);
  const two={...meal,counts:{meat:0,veg:2,soup:0}};const enough=options(two,[...recipes,simpleRecipe('egg',[['egg',1]])],async(_url,init)=>{const packet=JSON.parse(JSON.parse(String(init?.body)).messages.at(-1).content);return envelope({summary:'构造累计用量冲突',choices:packet.catalog.filter((item:any)=>item.name.startsWith('tomato')).map((item:any)=>({id:item.id,reason:'构造'}))});});
  const quantityIndependent=await createHealthRecipeSelector(randomBytes(32))(enough);assert.equal(quantityIndependent.status,'completed');assert.equal(quantityIndependent.dishes.length,2);
});

test('AI候选翻页与手选口味复用加密游标，不额外调用；跨实例可用，换账号/条件/篡改拒绝',async()=>{
  const meal={...oneMeal(),allowBuy:true,composition:'auto' as const,mode:'candidates' as const};
  const recipes=Array.from({length:8},(_,i)=>simpleRecipe(`r${i}`,[['tomato',50]]));for(const recipe of recipes)recipe.variants.push({...recipe.variants[0],id:`${recipe.id}-v2`,flavor:'微辣'});
  let calls=0;const secret=randomBytes(32);
  const input=options(meal,recipes,async(_url,init)=>{calls++;const packet=JSON.parse(JSON.parse(String(init?.body)).messages.at(-1).content);return envelope({summary:'构造8道可选菜',choices:packet.catalog.slice(0,packet.count).map((item:any)=>({id:item.id,reason:'按现有食材选择'}))});});
  const result=await createHealthRecipeSelector(secret)(input);assert(result.dishes.length>0&&result.dishes.length<6);assert.equal(result.total,result.dishes.length);assert(!result.cursor.includes('按现有食材'));assert(!result.cursor.includes(apiKey));
  await assert.rejects(createHealthRecipeSelector(secret)({...input,request:request(meal,{action:'page',page:1,cursor:result.cursor})}),/全部展示/);assert.equal(calls,1);
  await assert.rejects(createHealthRecipeSelector(secret)({...input,owner:'other-owner',request:request(meal,{action:'page',page:1,cursor:result.cursor})}),/过期/);
  await assert.rejects(createHealthRecipeSelector(secret)({...input,request:request({...meal,allowBuy:false},{action:'page',page:1,cursor:result.cursor})}),/过期/);
  await assert.rejects(createHealthRecipeSelector(secret)({...input,request:request(meal,{action:'page',page:1,cursor:result.cursor.slice(0,-8)+'aaaaaaaa'})}),/过期/);
  const selected=result.dishes[0].recipe.id;
  const variant=await createHealthRecipeSelector(secret)({...input,request:request({...meal,overrides:{[selected]:`${selected}-v2`}},{action:'variant',page:0,cursor:result.cursor,selected:result.dishes.map(dish=>({recipeId:dish.recipe.id,variantId:dish.variant.id}))})});
  assert.equal(variant.dishes.find(dish=>dish.recipe.id===selected)?.variant.id,`${selected}-v2`);assert.equal(calls,1);
});

test('换一道只让AI选择替代菜，保留其他菜与顺序',async()=>{
  const meal={...oneMeal(),counts:{meat:0,veg:2,soup:0}};
  const recipes=[simpleRecipe('keep',[['egg',1]]),simpleRecipe('old',[['tomato',100]]),simpleRecipe('new',[['tomato',100]])];
  const input=options(meal,recipes,async(_url,init)=>{const packet=JSON.parse(JSON.parse(String(init?.body)).messages.at(-1).content);assert.equal(packet.mode,'replacement');assert.deepEqual(packet.locked.map((item:any)=>item.name),['keep']);return envelope({summary:'替代选择',choices:[{id:packet.catalog.find((item:any)=>item.name==='new').id,reason:'构造替代理由'}]});});
  input.request=request(meal,{action:'replace',replaceId:'old',selected:[{recipeId:'keep',variantId:'keep-v'},{recipeId:'old',variantId:'old-v'}]});
  const result=await createHealthRecipeSelector(randomBytes(32))(input);assert.deepEqual(result.dishes.map(dish=>dish.recipe.id),['keep','new']);
});

test('真实账户推荐路径调用保存的Key和PG单次认领，普通推荐/分页不调用，重复操作不重发',async()=>{
  const {db,accounts}=await fixture();let calls=0;
  const app=await createApp({accounts,healthRecipeFetch:async(_url,init)=>{
    calls++;assert.equal(new Headers(init?.headers).get('authorization'),`Bearer ${apiKey}`);const packet=JSON.parse(JSON.parse(String(init?.body)).messages.at(-1).content);
    assert.equal(packet.user.allowBuy,true);return envelope({summary:'构造真实路径选菜',choices:packet.catalog.slice(0,packet.count).map((item:any)=>({id:item.id,reason:'构造用户食材与菜谱做法理由'}))});
  }});
  try{
    const registration=await accounts.registrationCode('ai-recipe@example.invalid','ai-recipe');const identity=await accounts.register({username:'ai-recipe',password:'Recipe!Test123',code:'123456',challenge:registration.challenge},'ai-recipe');await accounts.setHealthKey(identity,0,apiKey);
    const session=await app.inject('/api/v1/auth/session'),headers={cookie:`${String(session.headers['set-cookie']).split(';')[0]}; ${accounts.cookie(identity).split(';')[0]}`,origin:'http://localhost:80','x-csrf-token':session.json().csrfToken};
    const meal={...mealWith(),health:true,allowBuy:true,mode:'candidates' as const};const call=request(meal);
    const result=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:call});assert.equal(result.statusCode,200,result.body);assert.equal(result.json().healthAssessment.state,'model_selected');assert.equal(calls,1);assert(!result.body.includes(apiKey));
    const page=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:request(meal,{action:'page',page:1,cursor:result.json().cursor})});assert.equal(page.statusCode,409,page.body);assert.equal(calls,1);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:call})).statusCode,409);assert.equal(calls,1);
    await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:request({...meal,health:false})});assert.equal(calls,1);
    const rows=(await db.query('SELECT * FROM shiwei_ai_chat_operations')).rows;assert.equal(rows.length,1);assert(!JSON.stringify(rows).includes(apiKey));
  }finally{await app.close();await db.close();}
});

for(const [servings,custom,expected] of [[1,false,3],[4,false,7],[2,true,2]] as const)test('AI一餐约束：人数'+servings+' 自定义'+custom,async()=>{
  const meal={...oneMeal(),servings,allowBuy:true,mode:'candidates' as const,composition:custom?'custom' as const:'auto' as const,counts:custom?{meat:0,veg:2,soup:0}:{meat:1,veg:2,soup:0}};
  const recipes=Array.from({length:18},(_,i)=>simpleRecipe('constraint-'+i,[['tomato',50]],{category:i<6?'meat':i<12?'veg':'soup'}));
  const input=options(meal,recipes,async(_url,init)=>{const packet=JSON.parse(JSON.parse(String(init?.body)).messages.at(-1).content);assert.equal(packet.mode,'meal');assert.equal(packet.user.servings,servings);assert.equal(packet.user.allowBuy,true);assert.equal(packet.count,expected);const left={...packet.categories};return envelope({summary:'按本餐搭配',choices:packet.catalog.filter((item:any)=>{if(left[item.category]>0){left[item.category]--;return true;}return false;}).map((item:any)=>({id:item.id,reason:'符合本餐数量与分类'}))});});
  const result=await createHealthRecipeSelector(randomBytes(32))(input);assert.equal(result.dishes.length,expected);if(custom)assert(result.dishes.every(dish=>dish.recipe.category==='veg'));
});
