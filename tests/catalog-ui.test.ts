import test from 'node:test';
import assert from 'node:assert/strict';
import { contentContext } from '../shared/content';
import { availableFlavors } from '../shared/flavors';
import { defaultMeal, type Meal } from '../shared/types';
import { recommend } from '../backend/src/recommendation';
import { localUiContent } from '../scripts/lib/local-ui-content';
import { contentSeasonings, normalizeInput } from '../frontend/src/meal-input';
import { request } from './fixtures';

const context=contentContext(localUiContent());
test('空食材允许补买可看默认候选；不允许时提示，未知食材不冒充空清单',async()=>{
  const meal=defaultMeal();
  assert.equal((await recommend(context.recipes,request(meal),{context})).status,'needs_confirmation');
  meal.allowBuy=true;meal.mode='candidates';
  const result=await recommend(context.recipes,request(meal),{context});
  assert.equal(result.status,'completed');assert.equal(result.dishes.length,6);
  assert(result.dishes.every(d=>d.reused.length===0&&d.checks.some(c=>c.state==='missing')));
  meal.ingredients=[{id:'unknown',foodId:null,name:'未识别',amount:'',basis:'unknown',form:'raw',status:'pending',original:'未识别'}];
  assert.equal((await recommend(context.recipes,request(meal),{context})).status,'needs_confirmation');
});
test('空食材补买仍执行过敏、口味、调料与健康准入；自定义不受复用门槛误拦',async()=>{
  const meal: Meal={...defaultMeal(),allowBuy:true,mode:'candidates',flavor:'黑椒'};
  const result=await recommend(context.recipes,request(meal),{context});
  assert.equal(result.dishes.length,1);assert.equal(result.dishes[0].recipe.id,'beef-carrot');assert.equal(result.dishes[0].variant.flavor,'黑椒');
  meal.restrictions=[{id:'avoid',kind:'avoid',name:'牛肉',targets:['beef'],status:'confirmed',scope:'self',original:'不吃牛肉'}];
  assert.equal((await recommend(context.recipes,request(meal),{context})).dishes.length,0);
  meal.restrictions=[];meal.health=true;assert.equal((await recommend(context.recipes,request(meal),{context})).status,'unavailable');
  meal.health=false;meal.flavor='不限';meal.composition='custom';meal.mode='meal';meal.counts={meat:1,veg:2,soup:0};
  assert.equal((await recommend(context.recipes,request(meal),{context})).dishes.length,3);
  meal.flavor='不存在的口味';await assert.rejects(()=>recommend(context.recipes,request(meal),{context}),/所选口味/);
});
test('本地新版口味来自菜谱变体，调料只展示目录内记录，旧草稿清除失效覆盖',()=>{
  assert(availableFlavors(context.recipes).includes('酸甜'));
  assert.equal(context.recipes.find(r=>r.id==='shrimp-egg')!.variants.length,1);
  assert(contentSeasonings(context).includes('oyster-sauce'));assert(contentSeasonings(context).length>=29);
  const meal=normalizeInput({...defaultMeal(),flavor:'旧口味',overrides:{'shrimp-egg':'shrimp-egg-spicy'}},context);
  assert.equal(meal.flavor,'不限');assert.deepEqual(meal.overrides,{});
  assert.equal(context.recipes.find(r=>r.id==='tomato-egg')!.imageUrl,'/assets/recipes/tomato-scrambled-eggs-finedining-v1.png');
  assert.equal(context.recipes.find(r=>r.id==='shrimp-egg')!.imageUrl,undefined);
});
