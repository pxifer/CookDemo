import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {recommendationMeal,sameRecommendationInput} from '../shared/recommendation-input';
import {checkDish,checkSet,recommend} from '../backend/src/recommendation';
import {createHealthRecipeSelector} from '../backend/src/health-recipe-selection';
import {contentContext} from '../shared/content';
import {constructedContent} from '../shared/catalog';
import {mealWith,request,simpleRecipe} from './fixtures';
import {createApp} from '../backend/src/app';

test('用户用量仅作参考：去除判定量但保留显示原件、形态、人数、限制和菜谱原用量',()=>{
 const meal=mealWith('土豆1g');meal.raw='土豆1g';const original=structuredClone(meal);const large=structuredClone(meal);large.ingredients[0].amount='999kg';large.ingredients[0].quantityUnit='kg';large.ingredients[0].original='土豆999kg';large.raw='土豆999kg';large.version++;
 assert(sameRecommendationInput(meal,large));assert.equal(recommendationMeal(meal).ingredients[0].amount,'');assert.deepEqual(meal,original);
 large.ingredients[0].foodId='egg';assert(!sameRecommendationInput(meal,large));
 const unknown={...meal,restrictions:[{id:'r',name:'未知过敏',kind:'allergy' as const,targets:[],status:'unknown' as const,scope:'self' as const,original:'原始限制'}]};assert.deepEqual(recommendationMeal(unknown).restrictions,unknown.restrictions);
});

test('同一批食材1g/999kg/空值产生相同候选、排序、自动菜数，单菜及整套不检查输入量差额',async()=>{
 const catalog=Array.from({length:5},(_,i)=>simpleRecipe(`potato-${i}`,[['potato',100+i*100]]));
 const meal=mealWith('土豆1g'),before=structuredClone(catalog);const result=[];
 for(const amount of ['1g','999kg','']){
  const input=structuredClone(meal);input.ingredients[0].amount=amount;
  const single=checkDish(catalog[0],catalog[0].variants[0],input);assert(single.dish);assert(!single.dish.checks.some(c=>c.state==='shortage'));
  const value=await recommend(catalog,request(input,{operationId:'quantity-policy-fixed-seed'}));result.push(value);
  assert(checkSet(value.dishes,input).valid);assert(value.checks.every(c=>c.shortage===null&&c.needed===null));
 }
 assert.deepEqual(result.map(r=>r.dishes.map(d=>[d.recipe.id,d.variant.id])),Array(3).fill(result[0].dishes.map(d=>[d.recipe.id,d.variant.id])));assert.deepEqual(catalog,before);
});

test('忽略量仍排除缺失食材、过敏和有效避开，补买必须主动开启',async()=>{
 const potato=simpleRecipe('potato',[['potato',200]]),egg=simpleRecipe('egg',[['egg',1]]),meal=mealWith('土豆1g');
 assert.equal(checkDish(egg,egg.variants[0],meal).dish,undefined);
 meal.restrictions=[{id:'allergy',name:'土豆',kind:'allergy',scope:'self',targets:['potato'],status:'confirmed',original:'土豆过敏'}];assert.equal(checkDish(potato,potato.variants[0],meal).dish,undefined);
 meal.restrictions=[];meal.health=true;meal.aiFoodChoices={preferred:[],limited:[],excluded:['土豆']};assert.equal(checkDish(potato,potato.variants[0],meal).dish,undefined);
});

test('只改用量不使普通分页游标过期；不因用量大而增加候选或自动菜数',async()=>{
 const catalog=Array.from({length:8},(_,i)=>simpleRecipe(`potato-${i}`,[['potato',100]])),meal={...mealWith('土豆1g'),allowBuy:true,mode:'candidates' as const};
 const first=await recommend(catalog,request(meal));const changed=structuredClone(meal);changed.ingredients[0].amount='10000kg';changed.version++;
 const next=await recommend(catalog,request(changed,{action:'page',page:1,cursor:first.cursor}));assert.equal(next.dishes.length,2);assert.equal(next.total,8);
});

test('AI只接收食材有无，输入用量不送模型；只改量翻页也不额外调用',async()=>{
 const recipes=Array.from({length:7},(_,i)=>simpleRecipe(`p-${i}`,[['potato',100]])),context=contentContext({...constructedContent,recipes});const selector=createHealthRecipeSelector(randomBytes(32));let calls=0;
 const meal={...mealWith('土豆1g'),health:true,allowBuy:true,mode:'candidates' as const};
 const start={request:request(meal),owner:'quantity-policy',apiKey:'synthetic-test-only-key',context,signal:AbortSignal.timeout(10000),claim:async()=>{},progress:()=>{},present:(d:any)=>d,fetcher:async(_u:any,init:any)=>{
  calls++;const packet=JSON.parse(JSON.parse(String(init.body)).messages[1].content);assert(packet.user.ingredients.every((i:any)=>i.amount===''));assert(packet.catalog[0].ingredients.some((i:any)=>i.amount===100));
  return Response.json({id:'fixture-quantity-policy',model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:40,total_tokens:140},choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'构造选菜',choices:packet.catalog.map((c:any)=>({id:c.id,reason:'仅核对食材有无'}))})}}]});
 }};
 const first=await selector(start);const changed=structuredClone(meal);changed.ingredients[0].amount='999kg';const page=await selector({...start,request:request(changed,{action:'page',page:1,cursor:first.cursor})});assert.equal(page.dishes.length,1);assert.equal(calls,1);
});

test('真实API入口同样忽略客户端填写用量，不能绕过统一规则',async()=>{
 const app=await createApp();try{
  const session=await app.inject('/api/v1/auth/session');const headers={cookie:String(session.headers['set-cookie']).split(';')[0],origin:'http://localhost:80','x-csrf-token':session.json().csrfToken};
  const meal=mealWith();meal.ingredients.forEach(i=>i.amount='1g');const huge=structuredClone(meal);huge.version++;huge.ingredients.forEach(i=>i.amount='99999kg');
  const result=[];
  for(const input of [meal,huge]){const reply=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:request(input,{operationId:'same-quantity-policy-api-seed'})});assert.equal(reply.statusCode,200,reply.body);result.push(reply.json());}
  assert.deepEqual(result[0].dishes.map((d:any)=>[d.recipe.id,d.variant.id]),result[1].dishes.map((d:any)=>[d.recipe.id,d.variant.id]));assert.equal(result[0].target,result[1].target);
 }finally{await app.close();}
});
