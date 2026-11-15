import test from 'node:test';
import assert from 'node:assert/strict';
import { shoppingList } from '../frontend/src/recipe-presentation';
import { defaultMeal, type Dish, type Line } from '../shared/types';
import { foodById } from '../shared/catalog';

const meal = { ...defaultMeal(), allowBuy: true };
const line = (foodId: string, sourceText: string, extra: Partial<Line> = {}): Line => ({
  foodId, amount: null, unit: 'g', role: 'main', basis: 'unknown', form: 'raw', sourceText, ...extra,
});
const dish = (lines: Line[]): Dish => ({
  recipe: { id: 'r', name: 'r', category: 'veg', homeStyle: true, minutes: 10, servings: 1, image: 'veg', version: 'v', state: 'published', variants: [], source: { kind: 'constructed', author: 't', license: 't', reviewed: false } },
  variant: { id: 'v', flavor: 'x', lines, steps: [] },
  checks: lines.map(l => ({ foodId: l.foodId, name: l.foodId, state: 'missing', needed: null, available: 0, shortage: null, unit: '有无', reason: '', basis: 'unknown' })),
  reused: [], omitted: [], nutrition: { kcal: null, protein: null, sodium: null },
});

test('补买清单只合并同一食材的同一单位', () => {
  const list = shoppingList([dish([line('egg', '鸡蛋 2 个')]), dish([line('egg', '鸡蛋 3 个')])], meal, foodById);
  assert.deepEqual(list, ['鸡蛋 5个']);
});

test('单位不同不合并，保留两条', () => {
  const list = shoppingList([dish([line('egg', '鸡蛋 2 个')]), dish([line('egg', '鸡蛋 50 g')])], meal, foodById);
  assert.deepEqual(list, ['鸡蛋 2个', '鸡蛋 50g']);
});

test('范围用量与无法解析的原文不参与求和，也不重复', () => {
  const range = dish([line('tomato', '西红柿 3-4 个（每个约 200g）')]);
  assert.deepEqual(shoppingList([range, range], meal, foodById), ['西红柿 3-4 个（每个约 200g）']);
  const unknown = dish([line('egg', '鸡蛋')]);
  assert.deepEqual(shoppingList([unknown, unknown], meal, foodById), ['鸡蛋']);
});

test('不补买时没有补买清单', () => {
  assert.deepEqual(shoppingList([dish([line('egg', '鸡蛋 2 个')])], { ...meal, allowBuy: false }, foodById), []);
});
