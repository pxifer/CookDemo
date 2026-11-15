import test from 'node:test';
import assert from 'node:assert/strict';
import { findPantryIngredient, canonicalIngredientName, resolvePantryFood } from '../shared/ingredient-matching';
import type { Food } from '../shared/types';

const food = (name: string): Food => ({ id: `f-${name}`, name, aliases: [], unit: 'g', form: 'raw', allergens: [], componentsComplete: false, nutrition: {} });
const covers = (pantryName: string, recipeName: string) => {
  const pantry = food(pantryName), recipe = food(recipeName);
  const lookup = new Map([[pantry.id, pantry], [recipe.id, recipe]]);
  return Boolean(findPantryIngredient({ foodId: recipe.id, amount: null, unit: 'g', role: 'main', basis: 'unknown', form: 'raw' },
    [{ id: 'p', foodId: pantry.id, name: pantryName, amount: '', basis: 'unknown', form: 'raw', status: 'confirmed', original: pantryName }], lookup));
};

test('高频同物异名双向可匹配', () => {
  const pairs: [string, string][] = [
    ['洋葱', '圆葱'], ['小米辣', '小米椒'], ['豆角', '豇豆'], ['豆芽', '绿豆芽'],
    ['红椒', '红辣椒'], ['芹菜', '西芹'], ['豆腐', '北豆腐'], ['排骨', '猪排骨'],
    ['土豆', '马铃薯'], ['包菜', '卷心菜'], ['圣女果', '小番茄'], ['玉米', '玉米粒'],
  ];
  for (const [a, b] of pairs) {
    assert.equal(covers(a, b), true, `${a} 应覆盖 ${b}`);
    assert.equal(covers(b, a), true, `${b} 应覆盖 ${a}`);
  }
});

test('不同商品不因名称相近而互相覆盖', () => {
  for (const [a, b] of [['青椒', '红椒'], ['大白菜', '小白菜'], ['大葱', '小葱'], ['猪肉', '排骨']] as [string, string][]) {
    assert.equal(covers(a, b), false, `${a} 不应覆盖 ${b}`);
    assert.equal(covers(b, a), false, `${b} 不应覆盖 ${a}`);
  }
});

test('同义词组折叠到同一个展示名', () => {
  for (const [name, expected] of [['圆葱', '洋葱'], ['小米椒', '小米辣'], ['豇豆', '豆角'], ['西芹', '芹菜'], ['绿豆芽', '豆芽']] as [string, string][]) {
    assert.equal(canonicalIngredientName(name), expected, name);
  }
});

test('只出现在输入侧的别称也能解析到目录食材', () => {
  const lookup = new Map([['f-土豆', food('土豆')], ['f-莴笋', food('莴笋')], ['f-香菜', food('香菜')]]);
  assert.equal(resolvePantryFood('洋芋', lookup)?.name, '土豆');
  assert.equal(resolvePantryFood('莴苣', lookup)?.name, '莴笋');
  assert.equal(resolvePantryFood('芫荽', lookup)?.name, '香菜');
});
