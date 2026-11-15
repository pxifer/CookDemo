import test from 'node:test';
import assert from 'node:assert/strict';
import { compositionError, countShortfall, dishCounts, inputMode, totalCounts } from '../shared/meal-planning';
import { checkDish, checkSet, recommend } from '../backend/src/recommendation';
import { foodById } from '../shared/catalog';
import { mealWith, request, simpleRecipe } from './fixtures';
import { normalizeInput } from '../frontend/src/meal-input';
import { createApp } from '../backend/src/app';

test('菜数只有两种语义：不限数量浏览，或按荤素汤凑齐', () => {
  assert.equal(inputMode({ composition: 'auto' }), 'candidates');
  assert.equal(inputMode({ composition: 'custom' }), 'meal');
  assert.equal(compositionError({ composition: 'auto', counts: { meat: 0, veg: 0, soup: 0 } }), '');
  for (const counts of [{ meat: 0, veg: 0, soup: 0 }, { meat: 10, veg: 11, soup: 0 }, { meat: -1, veg: 1, soup: 0 }]) assert(compositionError({ composition: 'custom', counts }));
  assert.equal(compositionError({ composition: 'custom', counts: { meat: 10, veg: 10, soup: 0 } }), '');
  assert.equal(totalCounts({ meat: 10, veg: 10, soup: 0 }), 20);
  assert.deepEqual(countShortfall({ meat: 0, veg: 1, soup: 0 }, { meat: 1, veg: 3, soup: 1 }), { meat: 1, veg: 2, soup: 1 });
  assert.deepEqual(dishCounts([{ recipe: { category: 'meat' } }, { recipe: { category: 'veg' } }, { recipe: { category: 'veg' } }] as never), { meat: 1, veg: 2, soup: 0 });
});

test('取消自定义忽略残留空值/超量，恢复为不限数量且保留食材与补买选择', async () => {
  const m = mealWith('土豆500g'); m.counts = { meat: NaN, veg: 20, soup: 1 };
  assert.equal(compositionError(m), '');
  assert.equal((await recommend([simpleRecipe('p', [['potato', 100]])], request(m))).status, 'completed');
  m.allowBuy = true; m.composition = 'custom';
  assert(compositionError(m)); assert.equal(normalizeInput(m).mode, 'meal');
  m.composition = 'auto'; const normalized = normalizeInput(m);
  assert.equal(normalized.mode, 'candidates'); assert.deepEqual(normalized.counts, { meat: 1, veg: 1, soup: 0 });
  assert.deepEqual(normalized.ingredients.map(i=>i.foodId), m.ingredients.map(i=>i.foodId)); assert(normalized.ingredients.every(i=>i.amount==='')); assert.equal(normalized.allowBuy,m.allowBuy);
});

test('按指定荤素汤数量凑齐，不再由人数推算菜数', async () => {
  const catalog = [
    ...Array.from({ length: 4 }, (_, i) => simpleRecipe(`meat-${i}`, [['chicken', 100]], { category: 'meat' })),
    ...Array.from({ length: 6 }, (_, i) => simpleRecipe(`veg-${i}`, [['potato', 100]])),
    simpleRecipe('soup', [['tomato', 100]], { category: 'soup' }),
  ];
  const m = mealWith('鸡肉10000g土豆10000g西红柿10000g'); m.composition = 'custom'; m.counts = { meat: 2, veg: 3, soup: 1 };
  const result = await recommend(catalog, request(m));
  assert.deepEqual(result.dishes.map(d => d.recipe.category).sort(), ['meat', 'meat', 'soup', 'veg', 'veg', 'veg']);
  assert(result.targetMet); assert.deepEqual(result.shortfall, { meat: 0, veg: 0, soup: 0 });
  m.counts = { meat: 5, veg: 6, soup: 1 };
  const tooMany = await recommend(catalog, request(m));
  assert.equal(tooMany.dishes.length, 11); assert(!tooMany.targetMet); assert.deepEqual(tooMany.shortfall, { meat: 1, veg: 0, soup: 0 });
  assert.equal(tooMany.search, 'complete');
});

test('不限数量按食材匹配返回全部可做菜谱，分页而不是凑固定菜数', async () => {
  const catalog = [simpleRecipe('a', [['chicken', 100], ['mushroom', 100], ['carrot', 100]], { category: 'meat' }),
    simpleRecipe('b', [['potato', 100], ['spinach', 100], ['cabbage', 100]]),
    simpleRecipe('c', [['tomato', 100], ['egg', 1], ['tofu', 100]]),
    simpleRecipe('d', [['broccoli', 100], ['cucumber', 100], ['peanut', 100]])];
  const result = await recommend(catalog, request());
  assert.equal(result.dishes.length, 4); assert.equal(result.target, 0); assert.equal(result.targetMet, true);
  assert.equal(result.total, 4);
});

test('填写量、未知量与不同单位均不参与搭配估算，不伪造净量', async () => {
  const catalog = Array.from({ length: 4 }, (_, i) => simpleRecipe(`p-${i}`, [['potato', 100]]));
  const m = mealWith('土豆150g'); m.ingredients[0].basis = 'unknown';
  const result = await recommend(catalog, request(m)); assert.equal(result.dishes.length, 4);
  assert.equal(result.dishes[0].checks[0].state, 'unverified'); assert.equal(result.dishes[0].checks[0].shortage, null);
  m.ingredients[0].amount = '';
  assert.equal((await recommend(catalog, request(m))).dishes.length, 4);
  m.ingredients[0].amount = '2个';
  assert.equal((await recommend(catalog, request(m))).dishes.length, 4);
});

test('自定义20道：已具备食材不受填写量影响，补买仍不改变指定菜数，换菜保留19道', async () => {
  const catalog = Array.from({ length: 21 }, (_, i) => simpleRecipe(`egg-${String(i).padStart(2, '0')}`, [['egg', 1]]));
  const m = mealWith('鸡蛋2个'); m.composition = 'custom'; m.counts = { meat: 0, veg: 20, soup: 0 };
  const limited = await recommend(catalog, request(m)); assert.equal(limited.dishes.length, 20);
  assert(limited.targetMet);assert.deepEqual(limited.reasons,[]);
  m.allowBuy = true;
  const full = await recommend(catalog, request(m)); assert.equal(full.dishes.length, 20); assert(full.targetMet);
  assert.equal(new Set(full.dishes.map(d => d.recipe.id)).size, 20);
  assert.equal(full.checks.find(c => c.foodId === 'egg')?.shortage, null);
  const selected = full.dishes.map(d => ({ recipeId: d.recipe.id, variantId: d.variant.id }));
  const replaced = await recommend(catalog, request(m, { action: 'replace', selected, replaceId: selected[0].recipeId }));
  assert.equal(replaced.dishes.length, 20); assert(!replaced.dishes.some(d => d.recipe.id === selected[0].recipeId));
  for (const s of selected.slice(1)) assert(replaced.dishes.some(d => d.recipe.id === s.recipeId && d.variant.id === s.variantId));
  m.counts.veg = 21; await assert.rejects(recommend(catalog, request(m)), /1～20/);
});

test('补买不越过内容类别与过敏限制，不通过重复菜谱凑20道', async () => {
  const m = mealWith('土豆200g'); m.allowBuy = true; m.composition = 'custom'; m.counts = { meat: 0, veg: 20, soup: 0 };
  const result = await recommend([simpleRecipe('a', [['potato', 100]])], request(m));
  assert.equal(result.dishes.length, 1); assert(!result.targetMet); assert(!result.reasons.some(r => r.includes('指定数量')));
  assert.deepEqual(result.shortfall, { meat: 0, veg: 19, soup: 0 });
  m.restrictions = [{ id: 'r', kind: 'allergy', name: '土豆', targets: ['potato'], status: 'confirmed', scope: 'self', original: '土豆' }];
  assert.equal(checkDish(simpleRecipe('a', [['potato', 100]]), simpleRecipe('a', [['potato', 100]]).variants[0], m).dish, undefined);
});

test('手选口味不受填写量影响，变体固定原方用量仍保留', async () => {
  const a = simpleRecipe('a', [['egg', 2]]);
  a.variants.push({ ...a.variants[0], id: 'a-small', lines: [{ ...a.variants[0].lines[0], amount: 1 }] });
  const b = simpleRecipe('b', [['egg', 2]]);
  const m = mealWith('鸡蛋3个'); m.composition = 'custom'; m.counts = { meat: 0, veg: 2, soup: 0 };
  const full = await recommend([a, b], request(m));
  assert.equal(full.dishes.length, 2); assert(full.dishes.find(d => d.recipe.id === 'a'));assert.equal(a.variants[0].lines[0].amount,2);assert.equal(a.variants[1].lines[0].amount,1);
  m.overrides.a = 'a-v';
  const chosen = await recommend([a, b], request(m)); assert.equal(chosen.dishes.length, 2);
  assert(!chosen.dishes.some(d => d.variant.id === 'a-small'));
});

test('API接受20道请求和20个已选项，自动模式不再校验自定义总数', async () => {
  const app = await createApp();
  try {
    const s = await app.inject('/api/v1/auth/session');
    const headers = { cookie: s.headers['set-cookie']!.toString().split(';')[0], origin: 'http://localhost:80', 'x-csrf-token': s.json().csrfToken };
    const m = mealWith(); m.allowBuy = true; m.composition = 'custom'; m.counts = { meat: 0, veg: 20, soup: 0 };
    const res = await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(m, { selected: Array.from({ length: 20 }, (_, i) => ({ recipeId: `r-${i}`, variantId: `v-${i}` })), previous: Array.from({ length: 20 }, (_, i) => `r-${i}`) }) });
    assert.equal(res.statusCode, 200); assert.equal(res.json().target, 20);
    m.composition = 'auto'; m.counts = { meat: 0, veg: 0, soup: 0 }; m.version++;
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(m) })).statusCode, 200);
  } finally { await app.close(); }
});

test('D7-14新口径: 菜谱原方量与营养不随输入变化，选菜不计算输入量差额', () => {
  const potato = foodById.get('potato')!, original = potato.nutrition;
  potato.nutrition = { kcal: 80, protein: 2, sodium: 5 };
  try {
    const a = simpleRecipe('a', [['potato', 100]], { servings: 4 });
    const b = simpleRecipe('b', [['potato', 50]], { servings: 2 });
    const m = mealWith('土豆120g'); m.allowBuy = true;
    const dishes = [a, b].map(r => checkDish(r, r.variants[0], m).dish!);
    assert.equal(dishes[0].checks[0].needed, null);assert.equal(dishes[0].variant.lines[0].amount,100);
    assert.deepEqual(dishes[0].nutrition, { kcal: 80, protein: 2, sodium: 5 });
    const set = checkSet(dishes, m); assert(set.valid);
    assert.equal(set.checks[0].needed, null); assert.equal(set.checks[0].shortage, null);
    m.allowBuy = false; assert.equal(checkSet(dishes, m).valid, true); m.allowBuy = true;
  } finally { potato.nutrition = original; }
});

test('D7-14: 自定义组合只由荤素汤数量决定，重复请求结果稳定', async () => {
  const catalog = Array.from({ length: 3 }, (_, i) => simpleRecipe(`p-${i}`, [['potato', 100]]));
  const m = mealWith('土豆300g'); m.composition = 'custom'; m.counts = { meat: 0, veg: 3, soup: 0 };
  const one = await recommend(catalog, request(m,{operationId:'fixed-order-for-counts'}));
  const again = await recommend(catalog, request(m,{operationId:'fixed-order-for-counts'}));
  assert.equal(again.dishes.length, 3); assert(again.targetMet);
  assert.deepEqual(again.dishes, one.dishes); assert.deepEqual(again.checks, one.checks);
  assert.equal(again.checks[0].needed, null); assert.equal(again.checks[0].shortage, null);assert(again.dishes.every(d=>d.variant.lines[0].amount===100));
});
