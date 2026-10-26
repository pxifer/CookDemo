import test from 'node:test';
import assert from 'node:assert/strict';
import { recommend, checkSet } from '../server/recommendation';
import { mealWith, request, simpleRecipe } from './fixtures';

const catalog=Array.from({length:10},(_,i)=>simpleRecipe(`variety-${i}`,[['egg',1]],{category:i<4?'meat':'veg'}));
test('重复搭配在同等可行方案中变化组合与顺序；补买与不补买均遵守库存和限制',async()=>{
  for(const allowBuy of [false,true]){
    const meal={...mealWith('鸡蛋20个'),allowBuy};
    const sets=new Set<string>(),orders=new Set<string>();
    for(let n=0;n<8;n++){
      const result=await recommend(catalog,request(meal,{operationId:`variety-${n}`}));
      assert.equal(result.status,'completed');assert.equal(result.dishes.length,3);
      assert.equal(result.dishes.filter(d=>d.recipe.category==='meat').length,1);
      assert(checkSet(result.dishes,meal).valid);
      sets.add(result.dishes.map(d=>d.recipe.id).sort().join(','));
      orders.add(result.dishes.map(d=>d.recipe.id).join(','));
    }
    assert(sets.size>1,'one person sees more than a fixed set of recipes');assert(orders.size>1);
  }
});

test('同一轮候选翻页使用签名种子，不同操作ID仍顺序稳定且不重复漏菜',async()=>{
  const meal={...mealWith('鸡蛋20个'),mode:'candidates' as const};
  const first=await recommend(catalog,request(meal,{operationId:'first'}));
  const second=await recommend(catalog,request(meal,{operationId:'new-page-operation',action:'page',page:1,cursor:first.cursor}));
  const repeat=await recommend(catalog,request(meal,{operationId:'another-operation',cursor:first.cursor}));
  assert.deepEqual(repeat.dishes.map(d=>d.recipe.id),first.dishes.map(d=>d.recipe.id));
  assert.equal(new Set([...first.dishes,...second.dishes].map(d=>d.recipe.id)).size,10);
  await assert.rejects(recommend(catalog,request({...meal,allowBuy:true},{cursor:first.cursor})),{code:'CURSOR_EXPIRED'});
  await assert.rejects(recommend(catalog,request(meal,{cursor:`changed${first.cursor}`})),{code:'CURSOR_EXPIRED'});
});

test('单换首、中、末位置只替换目标卡片，保留其他菜及顺序',async()=>{
  const meal=mealWith('鸡蛋20个');
  const initial=await recommend(catalog,request(meal));
  assert.equal(initial.dishes.length,3);
  for(let index=0;index<initial.dishes.length;index++){
    const selected=initial.dishes.map(d=>({recipeId:d.recipe.id,variantId:d.variant.id}));
    const replacement=await recommend(catalog,request(meal,{action:'replace',replaceId:selected[index].recipeId,selected}));
    assert.equal(replacement.dishes.length,3);
    for(let slot=0;slot<selected.length;slot++){
      if(slot===index)assert.notEqual(replacement.dishes[slot].recipe.id,selected[slot].recipeId);
      else assert.equal(replacement.dishes[slot].recipe.id,selected[slot].recipeId);
    }
  }
});
