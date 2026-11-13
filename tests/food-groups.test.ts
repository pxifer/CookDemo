import test from 'node:test';
import assert from 'node:assert/strict';
import {groupedFoods,recipeFoodUsage} from '../frontend/src/food-groups';
import {canonicalIngredientName,isInvalidFoodName} from '../shared/ingredient-matching';
import {seasoningGroup} from '../shared/pantry';

const foods:any[]=[{id:'egg',name:'鸡蛋'},{id:'tomato',name:'番茄'},{id:'salt',name:'食盐'},{id:'unused',name:'奥尔良鸡翅腌料'}];
const recipes:any[]=[{variants:[{lines:[{foodId:'egg',role:'main'},{foodId:'tomato',role:'auxiliary'},{foodId:'unused',role:'seasoning'}]}]}];

test('食材下拉只按菜谱真实主料/辅料分类，未使用或仅作调料的食品不出现',()=>{
  const usage=recipeFoodUsage(recipes);
  assert.deepEqual([...usage.keys()].sort(),['egg','tomato']);
  const groups=groupedFoods(foods,usage);
  const names=groups.flatMap(group=>group.foods.map(food=>food.name));
  assert(names.includes('鸡蛋')&&names.includes('番茄'));
  assert(!names.includes('奥尔良鸡翅腌料')&&!names.includes('食盐'));
});

test('具体部位归并到可覆盖菜品的宽食材',()=>{
  assert.equal(canonicalIngredientName('五花肉'),'猪肉');
  assert.equal(canonicalIngredientName('肥瘦猪肉馅'),'猪肉');
  assert.equal(canonicalIngredientName('带皮鸡腿肉'),'鸡肉');
  assert.equal(canonicalIngredientName('本地鸡'),'鸡肉');
  assert.equal(canonicalIngredientName('海鱼'),'鱼');
  assert.equal(canonicalIngredientName('河虾'),'虾');
  assert.equal(canonicalIngredientName('花蛤'),'贝类');
  assert.equal(canonicalIngredientName('鸭腿'),'鸭肉');
  assert.equal(canonicalIngredientName('西红柿'),'番茄');
  assert.equal(canonicalIngredientName('猪大肠'),'猪肉');
  assert.equal(canonicalIngredientName('羊里脊'),'羊肉');
  assert.equal(canonicalIngredientName('樱桃谷鸭子'),'鸭肉');
  assert.equal(canonicalIngredientName('仔鸡'),'鸡肉');
  assert.equal(canonicalIngredientName('猪油'),'猪油');
});

test('下拉不会为同一宽食材重复列出多个部位',()=>{
  const cuts:any[]=[{id:'a',name:'五花肉'},{id:'b',name:'里脊'},{id:'c',name:'肥瘦猪肉馅'}];
  const usage=new Map([['a',3],['b',2],['c',1]]);
  const groups=groupedFoods(cuts,usage);
  const pork=groups.flatMap(group=>group.foods).filter(food=>food.name==='猪肉');
  assert.equal(pork.length,1);
});

test('调料按烹饪角色分组，不再全部堆进其他调料',()=>{
  assert.equal(seasoningGroup('芝麻酱'),'酱料与调味汁');
  assert.equal(seasoningGroup('香醋'),'醋与酒');
  assert.equal(seasoningGroup('熟白芝麻'),'香辛料与葱姜蒜');
  assert.equal(seasoningGroup('水淀粉'),'鲜味与勾芡');
  assert.equal(seasoningGroup('菜籽油'),'油与脂');
  assert.equal(seasoningGroup('食用盐'),'盐与基础调味');
});

test('数量/单位/碎片不会被当作食材',()=>{
  for(const name of ['一大块','一到','一朵','中等','适量','少许','一根','半个','900g','几个','几颗','二颗','二棵','十几','很多','数颗']) assert.equal(isInvalidFoodName(name),true,name);
  for(const name of ['八角','五花肉','鸡蛋','马铃薯','海虹','干海带','阿胶']) assert.equal(isInvalidFoodName(name),false,name);
  assert.equal(isInvalidFoodName('鸡蛋'),false);
  assert.equal(canonicalIngredientName('蛋液'),'鸡蛋');
  assert.equal(canonicalIngredientName('土鸡蛋'),'鸡蛋');
  assert.equal(canonicalIngredientName('咸鸭蛋'),'鸭蛋');
  assert.equal(canonicalIngredientName('筒子骨'),'猪肉');
  assert.equal(canonicalIngredientName('小肠'),'猪肉');
});