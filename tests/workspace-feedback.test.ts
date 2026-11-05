import test from 'node:test';
import assert from 'node:assert/strict';
import {recommend,checkDish} from '../backend/src/recommendation';
import {mealWith,request,simpleRecipe} from './fixtures';
import {foodGroup,groupedFoods} from '../frontend/src/food-groups';
import {constructedContent} from '../shared/catalog';

test('无结果和指定数量不足仅显示可操作建议，检查仍排除受限或缺料菜',async()=>{
  const a=simpleRecipe('土豆炒蛋',[['potato',100],['egg',1]]),b=simpleRecipe('白菜',[['cabbage',100]]);
  const meal=mealWith('土豆500g');meal.composition='custom';meal.counts={meat:0,veg:5,soup:0};
  meal.restrictions=[{id:'avoid',name:'白菜',kind:'avoid',targets:['cabbage'],scope:'self',status:'confirmed',original:'白菜'}];
  for(const composition of ['auto','custom'] as const)for(const allowBuy of [false,true]){
    const input={...meal,composition,allowBuy};
    const result=await recommend([a,b],request(input));
    assert.doesNotMatch(result.reasons.join(''),/需避开|含有|原方|未注明|清单中没有|配料信息|目录外|白菜/);
    assert(!result.dishes.some(d=>d.recipe.id===b.id));
    if(!allowBuy)assert.equal(result.dishes.length,0);
  }
  assert(!checkDish(b,b.variants[0],meal).dish);
});

test('单菜切换保留候选和套餐顺序；检查忌口与食材有无，忽略填写量',async()=>{
  const a=simpleRecipe('双味土豆',[['potato',100]]),b=simpleRecipe('鸡蛋',[['egg',1]]);
  a.variants.push({...a.variants[0],id:'another',flavor:'酸甜',steps:['第二种做法'],lines:[{...a.variants[0].lines[0],amount:150}]});
  const selected=[{recipeId:b.id,variantId:b.variants[0].id},{recipeId:a.id,variantId:a.variants[0].id}];
  for(const mode of ['meal','candidates'] as const){
    const meal={...mealWith('土豆500g鸡蛋5个'),mode,overrides:{[a.id]:'another'}};
    const changed=await recommend([a,b],request(meal,{action:'variant',selected,page:2}));
    assert.equal(changed.changed,true);assert.equal(changed.page,2);
    assert.deepEqual(changed.dishes.map(d=>d.recipe.id),[b.id,a.id]);
    assert.equal(changed.dishes[1].variant.id,'another');assert.equal(changed.dishes[0].variant.id,b.variants[0].id);
    const blocked=await recommend([a,b],request({...meal,restrictions:[{id:'a',name:'土豆',targets:['potato'],kind:'avoid',scope:'self',status:'confirmed',original:'土豆'}]},{action:'variant',selected}));
    assert.equal(blocked.changed,false);assert.equal(blocked.status,'needs_confirmation');
    assert.doesNotMatch(blocked.reasons.join(''),/含有|原方|需避开/);
  }
  const c=simpleRecipe('另一道土豆',[['potato',100]]);
  const limited={...mealWith('土豆200g'),overrides:{[a.id]:'another'}};
  const rejected=await recommend([a,c],request(limited,{action:'variant',selected:[{recipeId:a.id,variantId:a.variants[0].id},{recipeId:c.id,variantId:c.variants[0].id}]}));
  assert.equal(rejected.changed,true,'填写量不限制同一食材用于多菜');assert.equal(rejected.dishes.length,2);
});

test('食材分类覆盖常见菜料，调料和水不混入选择入口',()=>{
  for(const [name,group] of [['牛肉','肉禽'],['鸡胸肉','肉禽'],['鲈鱼','鱼虾海鲜'],['鱼肉','鱼虾海鲜'],['鸡蛋','蛋类'],['西兰花','蔬菜'],['蒜苗','蔬菜'],['娃娃菜','蔬菜'],['莲藕','蔬菜'],['香菇','菌菇'],['豆腐','豆制品'],['素鸡','豆制品'],['粉条','主食杂粮'],['玉米','主食杂粮'],['牛奶','奶类'],['牛油果','水果'],['核桃','豆类坚果'],['莲子','豆类坚果']])assert.equal(foodGroup(name),group,name);
  const result=groupedFoods([...constructedContent.foods,...constructedContent.foods]);
  for(const [name,group] of [['蟹味菇','菌菇'],['杏鲍菇','菌菇'],['海米','鱼虾海鲜'],['樱桃谷鸭子','肉禽'],['小米椒','蔬菜'],['土豆干粉条','主食杂粮'],['马蹄','蔬菜'],['肉桂皮','调味料'],['湖南米醋','调味料']])assert.equal(foodGroup(name),group,name);
  for(const [name,group] of [['小米辣','蔬菜'],['橄榄菜','蔬菜'],['新奥尔良烤翅调料','调味料'],['咖喱粉','调味料'],['鸡粉','调味料'],['花椒面','调味料'],['牛肉高汤','汤底饮品'],['肋排','肉禽']])assert.equal(foodGroup(name),group,name);
  const names=result.flatMap(g=>g.foods.map(f=>f.name));
  assert.equal(new Set(names).size,names.length);assert(!names.includes('盐'));assert(!names.includes('食用油'));assert(!names.includes('水'));
});
