import test from 'node:test';
import assert from 'node:assert/strict';
import { extractText } from '../shared/extraction';
import { parseQuantity, quantityCheck } from '../shared/quantity';
import { defaultMeal, type Line } from '../shared/types';
import { amountParts, inputIngredient, mergeInput, normalizeInput, setAmount } from '../src/meal-input';

test('D7-04: 已知食材直接使用，未知名称不伪造标准食材，调料不进入主料清单', () => {
  assert.equal(inputIngredient('土豆').status, 'confirmed');
  assert.equal(inputIngredient('未知食物').foodId, null);
  assert.deepEqual(mergeInput([], extractText('鸡蛋3个盐2g生抽1ml').ingredients).map(i => i.foodId), ['egg']);
});
test('D7-04: 选填单位空值保持空值，g/kg换算、约量和带单位粘贴保留', () => {
  const potato = inputIngredient('土豆');
  const empty = setAmount(potato, '', 'kg');
  assert.equal(empty.amount, ''); assert.equal(amountParts(empty).unit, 'kg');
  assert.deepEqual(parseQuantity(setAmount(potato, '0.5', 'kg').amount), { amount: 500, unit: 'g' });
  assert.equal(setAmount(potato, '200g', 'kg').amount, '200g');
  assert.deepEqual(amountParts({ amount: '一把' }), { value: '一', unit: '把' });
  assert.equal(parseQuantity(setAmount(potato, '一', '把').amount), null);
});
test('D7-04: 同名不同数量保留原值、换算相同不冲突、重复空值不清空', () => {
  const item = { ...inputIngredient('土豆'), amount: '500g', basis: 'edible' as const };
  const next = mergeInput([item], extractText('土豆200g').ingredients)[0];
  assert.equal(next.amount, '500g'); assert.equal(next.alternative, '200g'); assert.equal(next.status, 'conflict');
  assert.equal(mergeInput([item], extractText('土豆0.5kg').ingredients)[0].status, 'confirmed');
  assert.equal(mergeInput([item], [inputIngredient('土豆')])[0].amount, '500g');
  assert.equal(mergeInput([item], extractText('土豆500g').ingredients)[0].basis, 'edible');
});
test('D7-04: 去掉基准控件不假定净量，也不把克数当鸡蛋个数', () => {
  const line: Line = { foodId: 'potato', amount: 100, unit: 'g', role: 'main', basis: 'edible', form: 'raw' };
  assert.equal(quantityCheck(line, 100, setAmount(inputIngredient('土豆'), '500', 'g')).state, 'unverified');
  assert.equal(quantityCheck({ ...line, foodId: 'egg', unit: '个' }, 2, setAmount(inputIngredient('鸡蛋'), '500', 'g')).state, 'unverified');
});
test('D7-06: 恢复旧本餐时按补买切换模式，不改变数量冲突或同行人开关', () => {
  const meal = defaultMeal(); meal.allowBuy = true; meal.ingredients = extractText('土豆500g').ingredients;
  const next = normalizeInput(meal);
  assert.equal(next.mode, 'candidates'); assert.equal(next.includeAdditional, false);
  assert.equal(next.ingredients[0].status, 'confirmed'); assert.equal(next.ingredients[0].basis, 'unknown');
  next.ingredients[0].status = 'conflict'; next.allowBuy = false;
  const restored = normalizeInput(next); assert.equal(restored.mode, 'meal'); assert.equal(restored.ingredients[0].status, 'conflict');
});
