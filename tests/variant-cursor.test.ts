import test from 'node:test';
import assert from 'node:assert/strict';
import {recommend} from '../backend/src/recommendation';
import {createApp} from '../backend/src/app';
import {businessFixture} from './content-fixture';
import {contentContext} from '../shared/content';
import {extractText} from '../shared/extraction';
import {defaultMeal,type Meal,type RecommendationResult} from '../shared/types';
import {mealWith,request,simpleRecipe} from './fixtures';
const selected=(result:RecommendationResult)=>result.dishes.map(d=>({recipeId:d.recipe.id,variantId:d.variant.id}));

test('真实游标支持首次切换和再次切回，更新营养并保留库存核验',async()=>{
  const context=contentContext(businessFixture()),meal:Meal={...defaultMeal(),flavor:'清淡',ingredients:extractText('构造角瓜200g',context).ingredients.map(i=>({...i,status:'confirmed',basis:'edible'}))};
  const initial=await recommend(context.recipes,request(meal),{context});assert.equal(initial.dishes.length,1);assert.equal(initial.dishes[0].nutrition.kcal,20);
  const spicy={...meal,overrides:{'local-zucchini':'local-zucchini-spicy'}};
  const changed=await recommend(context.recipes,request(spicy,{action:'variant',cursor:initial.cursor,selected:selected(initial)}),{context});
  assert.equal(changed.changed,true);assert.equal(changed.dishes[0].variant.id,'local-zucchini-spicy');assert.equal(changed.dishes[0].nutrition.kcal,30);
  assert.equal(changed.cursor.split('.')[0],initial.cursor.split('.')[0]);assert.notEqual(changed.cursor,initial.cursor);
  const mild={...meal,version:meal.version+1,overrides:{'local-zucchini':'local-zucchini-light'}};
  const back=await recommend(context.recipes,request(mild,{action:'variant',cursor:changed.cursor,selected:selected(changed)}),{context});
  assert.equal(back.dishes[0].variant.id,'local-zucchini-light');assert.equal(back.dishes[0].nutrition.kcal,20);
  const limited={...meal,ingredients:extractText('构造角瓜120g',context).ingredients.map(i=>({...i,status:'confirmed' as const,basis:'edible' as const}))};
  const enough=await recommend(context.recipes,request(limited),{context});
  const rejected=await recommend(context.recipes,request({...limited,overrides:spicy.overrides},{action:'variant',cursor:enough.cursor,selected:selected(enough)}),{context});
  assert.equal(rejected.changed,true);assert.equal(rejected.status,'completed');assert.equal(rejected.dishes[0].variant.id,'local-zucchini-spicy');
});

const candidates=Array.from({length:10},(_,i)=>{const recipe=simpleRecipe(`cursor-${i}`,[['egg',1]]);recipe.variants.push({...recipe.variants[0],id:`cursor-${i}-spicy`,flavor:'微辣',steps:['该口味做法']});return recipe;});
test('候选切换保留排序种子、其他卡片和顺序，新游标继续翻页不重复漏菜',async()=>{
  const meal={...mealWith('鸡蛋20个'),mode:'candidates' as const,flavor:'清淡'},first=await recommend(candidates,request(meal));
  const target=first.dishes[0],nextMeal={...meal,overrides:{[target.recipe.id]:target.recipe.variants[1].id}};
  const changed=await recommend(candidates,request(nextMeal,{action:'variant',page:first.page,cursor:first.cursor,selected:selected(first)}));
  assert.deepEqual(changed.dishes.map(d=>d.recipe.id),first.dishes.map(d=>d.recipe.id));
  assert.deepEqual(changed.dishes.slice(1).map(d=>d.variant.id),first.dishes.slice(1).map(d=>d.variant.id));
  assert.equal(changed.dishes[0].variant.id,target.recipe.variants[1].id);
  const next=await recommend(candidates,request(nextMeal,{action:'page',page:1,cursor:changed.cursor}));
  assert.equal(new Set([...changed.dishes,...next.dishes].map(d=>d.recipe.id)).size,10);
  await assert.rejects(recommend(candidates,request(nextMeal,{action:'page',page:1,cursor:first.cursor})),{code:'CURSOR_EXPIRED'});
});

test('口味切换不能借旧游标更改硬条件、多道口味、目录或签名',async()=>{
  const meal={...mealWith('鸡蛋20个'),mode:'candidates' as const,flavor:'清淡'},first=await recommend(candidates,request(meal)),target=first.dishes[0];
  const nextMeal={...meal,overrides:{[target.recipe.id]:target.recipe.variants[1].id}};
  const call=(input:Meal,cursor=first.cursor,catalog=candidates)=>recommend(catalog,request(input,{action:'variant',cursor,selected:selected(first)}));
  for(const input of [{...nextMeal,allowBuy:true},{...nextMeal,servings:2},{...nextMeal,checkSeasonings:true},{...nextMeal,seasonings:[]},{...nextMeal,flavor:'微辣'},{...nextMeal,ingredients:[]},{...nextMeal,restrictions:[{id:'avoid',name:'鸡蛋',kind:'avoid' as const,scope:'self' as const,status:'confirmed' as const,targets:['egg'],original:'鸡蛋'}]},{...nextMeal,overrides:{...nextMeal.overrides,[first.dishes[1].recipe.id]:first.dishes[1].recipe.variants[1].id}}])await assert.rejects(call(input),{code:'CURSOR_EXPIRED'});
  await assert.rejects(call(nextMeal,first.cursor+'x'),{code:'CURSOR_EXPIRED'});
  await assert.rejects(call(nextMeal,first.cursor,[...candidates,simpleRecipe('new-recipe',[['egg',1]])]),{code:'CURSOR_EXPIRED'});
});

test('真实API生成后携游标切换：JSON和NDJSON都返回完整成功终态',async()=>{
  for(const stream of [false,true]){
    const app=await createApp();
    try{
      const session=await app.inject('/api/v1/auth/session'),headers={cookie:String(session.headers['set-cookie']).split(';')[0],origin:'http://localhost:80','x-csrf-token':session.json().csrfToken,...(stream?{accept:'application/x-ndjson'}:{})};
      const meal={...mealWith(),flavor:'清淡'};
      const send=async(payload:ReturnType<typeof request>)=>{const response=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload});assert.equal(response.statusCode,200,response.body);if(!stream)return response.json() as RecommendationResult;const frames=response.body.trim().split('\n').map(line=>JSON.parse(line));assert.equal(frames.at(-1).type,'result',response.body);return frames.at(-1).result as RecommendationResult;};
      const first=await send(request(meal)),target=first.dishes.find(d=>d.recipe.variants.length>1)!;assert(target);
      const alternative=target.recipe.variants.find(v=>v.id!==target.variant.id)!;
      const result=await send(request({...meal,overrides:{[target.recipe.id]:alternative.id}},{action:'variant',cursor:first.cursor,selected:selected(first)}));
      assert.equal(result.changed,true);assert.deepEqual(result.dishes.map(d=>d.recipe.id),first.dishes.map(d=>d.recipe.id));assert.equal(result.dishes.find(d=>d.recipe.id===target.recipe.id)!.variant.id,alternative.id);
    }finally{await app.close();}
  }
});
