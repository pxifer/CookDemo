import test from 'node:test';
import assert from 'node:assert/strict';
import { countOptions, modeSummary, resultHeadline, shortfallText } from '../frontend/src/meal-summary';
import type { RecommendationResult } from '../shared/types';

const dish = (category: 'meat' | 'veg' | 'soup') => ({ recipe: { category } }) as RecommendationResult['dishes'][number];

test('荤素汤下拉选项随其余两类联动，合计不超过20', () => {
  const counts = { meat: 1, veg: 1, soup: 0 };
  assert.deepEqual(countOptions(counts, 'meat'), Array.from({ length: 20 }, (_, i) => i));
  assert.deepEqual(countOptions(counts, 'veg'), Array.from({ length: 20 }, (_, i) => i));
  assert.deepEqual(countOptions(counts, 'soup'), Array.from({ length: 19 }, (_, i) => i));
  assert.deepEqual(countOptions({ meat: 10, veg: 10, soup: 0 }, 'meat'), Array.from({ length: 11 }, (_, i) => i));
  assert.deepEqual(countOptions({ meat: 10, veg: 5, soup: 0 }, 'soup'), Array.from({ length: 6 }, (_, i) => i));
});

test('缺额文案覆盖非零类别并区分配齐', () => {
  assert.equal(shortfallText(undefined), '');
  assert.equal(shortfallText({ meat: 0, veg: 0, soup: 0 }), '');
  assert.equal(shortfallText({ meat: 1, veg: 0, soup: 2 }), '还缺：荤菜 1 道 · 汤 2 道');
});

test('结果主行区分配齐、找到数量与各种终态', () => {
  const custom = { composition: 'custom' as const, counts: { meat: 1, veg: 2, soup: 0 } };
  const unlimited = { composition: 'auto' as const, counts: { meat: 1, veg: 1, soup: 0 } };
  const base = { status: 'completed' as const, dishes: [dish('meat'), dish('veg'), dish('veg')], targetMet: true };
  assert.equal(resultHeadline(custom, base), '已按目标配齐');
  assert.equal(resultHeadline(unlimited, base), '为你找到 3 道');
  assert.equal(resultHeadline(custom, { ...base, targetMet: false }), '为你找到 3 道');
  assert.equal(resultHeadline(custom, { ...base, status: 'needs_confirmation' }), '还有信息需要核对');
  assert.equal(resultHeadline(custom, { ...base, status: 'no_results', dishes: [] }), '暂时没有合适的搭配');
  assert.equal(resultHeadline(custom, { ...base, status: 'unavailable' }), '本次推荐未完成');
});

test('结果副标题是状态句，不写每页几道', () => {
  const custom = { composition: 'custom' as const, counts: { meat: 1, veg: 2, soup: 0 } };
  const unlimited = { composition: 'auto' as const, counts: { meat: 1, veg: 1, soup: 0 } };
  assert.equal(modeSummary(custom), '目标 1 荤 · 2 素');
  assert.equal(modeSummary({ composition: 'custom', counts: { meat: 0, veg: 0, soup: 0 } }), '未设置数量');
  assert.equal(modeSummary(unlimited), '按现有食材匹配');
  assert.equal(modeSummary(unlimited, 43), '共 43 道');
});
