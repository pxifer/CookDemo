import test from 'node:test';
import assert from 'node:assert/strict';
import {groupedFoods,recipeFoodUsage} from '../frontend/src/food-groups';
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

test('调料按烹饪角色分组，不再全部堆进其他调料',()=>{
  assert.equal(seasoningGroup('芝麻酱'),'酱料与调味汁');
  assert.equal(seasoningGroup('香醋'),'醋与酒');
  assert.equal(seasoningGroup('熟白芝麻'),'香辛料与葱姜蒜');
  assert.equal(seasoningGroup('水淀粉'),'鲜味与勾芡');
  assert.equal(seasoningGroup('菜籽油'),'油与脂');
  assert.equal(seasoningGroup('食用盐'),'盐与基础调味');
});
