import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesListedFood} from '../shared/food-restrictions';
import type {Food} from '../shared/types';
import {inventoryChecks} from '../shared/quantity';
import {defaultMeal,type Line} from '../shared/types';
const food=(name:string):Food=>({id:name,name,aliases:[],unit:'g',form:'raw',allergens:[],componentsComplete:false,nutrition:{}});
test('食品级限制覆盖同物别名、切法和肉类部位，特定部位不扩大到同类全部',()=>{
  assert(matchesListedFood(food('五花肉粒'),[food('猪肉')]));
  assert(matchesListedFood(food('猪里脊'),[food('猪肉')]));
  assert(matchesListedFood(food('蒜片'),[food('大蒜')]));
  assert(!matchesListedFood(food('猪里脊'),[food('五花肉')]));
  assert(!matchesListedFood(food('鸡蛋'),[food('鸡肉')]));
});
test('食品级限制不推断复合调料内部成分',()=>{
  assert(!matchesListedFood({...food('生抽'),allergens:['soy','wheat']},[food('大豆'),food('小麦')]));
  assert(matchesListedFood(food('生抽'),[food('生抽')]));
  assert(!matchesListedFood(food('鱼香肉丝'),[food('鱼')]));
});
test('整餐混合计量保留未知项和可比较的已知缺口，不报错或相互覆盖',()=>{
  const potato=food('土豆'),lookup=new Map([[potato.id,potato]]);
  const line:Line={foodId:potato.id,amount:100,unit:'g',role:'main',basis:'edible',form:'raw'};
  const meal={...defaultMeal(),ingredients:[{id:'fixture',foodId:potato.id,name:potato.name,amount:'150g',basis:'edible' as const,form:'raw',status:'confirmed' as const,original:'土豆150g'}]};
  const checks=inventoryChecks([line,line,{...line,amount:null,basis:'unknown'},{...line,amount:null,unit:'个'}],1,meal,lookup);
  assert.equal(checks.find(check=>check.state==='shortage')?.shortage,50);
  assert.equal(checks.filter(check=>check.state==='unverified').length,2);
});
