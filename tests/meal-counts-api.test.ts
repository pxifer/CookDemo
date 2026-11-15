import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../backend/src/app';
import { mealWith, request } from './fixtures';
import type { Meal } from '../shared/types';

async function api() {
  const app = await createApp();
  const session = await app.inject('/api/v1/auth/session');
  const headers = { cookie: session.headers['set-cookie']!.toString().split(';')[0], origin: 'http://localhost:80', 'x-csrf-token': session.json().csrfToken };
  const post = async (meal: Meal, extra: Record<string, unknown> = {}) =>
    app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(meal, extra) });
  return { app, post };
}

test('不限数量按食材匹配浏览：target为0、无缺额、每道都复用现有主料', async () => {
  const { app, post } = await api();
  try {
    const meal = mealWith();
    assert.equal(meal.composition, 'auto');
    const res = await post(meal);
    assert.equal(res.statusCode, 200, res.body);
    const result = res.json();
    assert.equal(result.status, 'completed');
    assert.equal(result.target, 0);
    assert.equal(result.targetMet, true);
    assert.equal(result.shortfall, undefined);
    assert(result.dishes.length > 0);
    for (const d of result.dishes) {
      assert(d.reused.length > 0, `${d.recipe.name} 未复用现有主料`);
      assert(d.checks.every((c: { state: string }) => c.state !== 'missing'), `${d.recipe.name} 缺必需食材`);
    }
  } finally { await app.close(); }
});

test('允许补买的不限数量仍是每页6道候选，不会变成全库一次性返回', async () => {
  const { app, post } = await api();
  try {
    const meal = mealWith(); meal.allowBuy = true;
    const res = await post(meal);
    assert.equal(res.statusCode, 200, res.body);
    const result = res.json();
    assert.equal(result.dishes.length, 6);
    assert(result.total >= 6);
    assert.equal(result.target, 0);
  } finally { await app.close(); }
});

test('按荤素汤数量精确出餐并返回三类配齐', async () => {
  const { app, post } = await api();
  try {
    const meal = mealWith(); meal.composition = 'custom'; meal.counts = { meat: 1, veg: 2, soup: 0 };
    const res = await post(meal);
    assert.equal(res.statusCode, 200, res.body);
    const result = res.json();
    assert.equal(result.status, 'completed');
    assert.equal(result.dishes.length, 3);
    assert.equal(result.target, 3);
    assert.equal(result.targetMet, true);
    assert.deepEqual(result.shortfall, { meat: 0, veg: 0, soup: 0 });
    const counts = { meat: 0, veg: 0, soup: 0 };
    for (const d of result.dishes) counts[d.recipe.category as keyof typeof counts]++;
    assert.deepEqual(counts, { meat: 1, veg: 2, soup: 0 });
    assert.deepEqual(result.reasons, []);
  } finally { await app.close(); }
});

test('按荤素汤凑不齐时按类给缺额和可操作原因，不静默少给', async () => {
  const { app, post } = await api();
  try {
    const meal = mealWith('鸡蛋5个'); meal.composition = 'custom'; meal.counts = { meat: 0, veg: 0, soup: 20 };
    const res = await post(meal);
    assert.equal(res.statusCode, 200, res.body);
    const result = res.json();
    assert(result.dishes.length < 20);
    assert.equal(result.targetMet, false);
    assert.equal(result.shortfall.soup, 20 - result.dishes.length);
    assert.equal(result.shortfall.meat, 0);
    assert.equal(result.shortfall.veg, 0);
    assert(!result.reasons.some((r: string) => r.includes('指定数量')), result.reasons.join('|'));
  } finally { await app.close(); }
});

test('补买不能让不适用的菜凑数：只放土豆时按荤素汤仍按类报缺', async () => {
  const { app, post } = await api();
  try {
    const meal = mealWith('土豆500g'); meal.allowBuy = true; meal.composition = 'custom'; meal.counts = { meat: 0, veg: 0, soup: 20 };
    const res = await post(meal);
    assert.equal(res.statusCode, 200, res.body);
    const result = res.json();
    assert(result.dishes.length < 20);
    assert.equal(result.targetMet, false);
    assert(result.shortfall.soup > 0);
    for (const d of result.dishes) assert(d.reused.includes('potato'), `${d.recipe.name} 未复用土豆`);
  } finally { await app.close(); }
});

test('过渡版本容忍旧人数字段并忽略，仍区分Schema与菜数语义错误', async () => {
  const { app, post } = await api();
  try {
    const baselineRes = await post(mealWith());
    assert.equal(baselineRes.statusCode, 200, baselineRes.body);
    const baseline = baselineRes.json();

    const withDiner = mealWith() as Meal & { servings?: number };
    withDiner.servings = 2;
    const legacy = await post(withDiner);
    assert.equal(legacy.statusCode, 200, legacy.body);
    const legacyResult = legacy.json();
    assert.equal(legacyResult.dishes.length, baseline.dishes.length);
    assert.equal(legacyResult.target, baseline.target);
    assert.equal(legacyResult.targetMet, baseline.targetMet);

    const zero = mealWith(); zero.composition = 'custom'; zero.counts = { meat: 0, veg: 0, soup: 0 };
    const zeroRes = await post(zero);
    assert.equal(zeroRes.statusCode, 400);
    assert.equal(zeroRes.json().error.code, 'INVALID_COMPOSITION');

    const over = mealWith(); over.composition = 'custom'; over.counts = { meat: 21, veg: 0, soup: 0 };
    const overRes = await post(over);
    assert.equal(overRes.statusCode, 400);
    assert.equal(overRes.json().error.code, 'INVALID_REQUEST');
  } finally { await app.close(); }
});

test('菜数变化使旧游标失效，不能拿旧页继续凑数', async () => {
  const { app, post } = await api();
  try {
    const meal = mealWith(); meal.composition = 'custom'; meal.counts = { meat: 1, veg: 2, soup: 0 };
    const first = await post(meal);
    assert.equal(first.statusCode, 200, first.body);
    const cursor = first.json().cursor;
    const changed = mealWith(); changed.composition = 'custom'; changed.counts = { meat: 1, veg: 2, soup: 1 };
    const next = await post(changed, { action: 'page', page: 1, cursor });
    assert.equal(next.statusCode, 409);
    assert.equal(next.json().error.code, 'CURSOR_EXPIRED');
  } finally { await app.close(); }
});
