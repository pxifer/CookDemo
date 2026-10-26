import test from 'node:test';
import assert from 'node:assert/strict';
import { compositionError, servingReferences } from '../shared/meal-planning';
import { checkDish, checkSet, recommend } from '../server/recommendation';
import { foodById } from '../shared/catalog';
import { mealWith, request, simpleRecipe } from './fixtures';
import { normalizeInput } from '../src/meal-input';
import { createApp } from '../server/app';

test('人数参考覆盖1～12人，2/3人两荤三素，参考不是自定义限制', () => {
  assert.deepEqual(servingReferences.map(r => r.servings), Array.from({ length: 12 }, (_, i) => i + 1));
  assert.deepEqual(servingReferences[0].counts, { meat: 1, veg: 2, soup: 0 });
  for (const i of [1, 2]) assert.deepEqual(servingReferences[i].counts, { meat: 2, veg: 3, soup: 0 });
  for (const r of servingReferences) assert(r.total > 0 && r.total <= 20);
});

test('取消自定义忽略残留空值/超量，恢复为自动且保留食材与补买选择', async () => {
  const m = mealWith('土豆500g'); m.counts = { meat: NaN, veg: 20, soup: 1 };
  assert.equal(compositionError(m), '');
  assert.equal((await recommend([simpleRecipe('p', [['potato', 100]])], request(m))).status, 'completed');
  m.allowBuy = true; m.composition = 'custom';
  assert(compositionError(m)); assert.equal(normalizeInput(m).mode, 'meal');
  m.composition = 'auto'; const normalized = normalizeInput(m);
  assert.equal(normalized.mode, 'candidates'); assert.deepEqual(normalized.counts, servingReferences[0].counts);
  assert.deepEqual(normalized.ingredients, m.ingredients);
});

test('自动按人数与累计食材量调整：2人五道、4人七道，量少则减少', async () => {
  const catalog = [
    ...Array.from({ length: 4 }, (_, i) => simpleRecipe(`meat-${i}`, [['chicken', 100]], { category: 'meat' })),
    ...Array.from({ length: 6 }, (_, i) => simpleRecipe(`veg-${i}`, [['potato', 100]])),
    simpleRecipe('soup', [['tomato', 100]], { category: 'soup' }),
  ];
  const m = mealWith('鸡肉10000g土豆10000g西红柿10000g'); m.servings = 2;
  const two = await recommend(catalog, request(m));
  assert.equal(two.dishes.length, 5); assert.equal(two.dishes.filter(d => d.recipe.category === 'meat').length, 2);
  m.servings = 4;
  const four = await recommend(catalog, request(m)); assert.equal(four.dishes.length, 7);
  m.ingredients = mealWith('鸡肉100g土豆100g西红柿100g').ingredients;
  const little = await recommend(catalog, request(m)); assert.equal(little.dishes.length, 3);
  assert.equal(little.search,'complete');
  assert.deepEqual(little.reasons,[]); // Successful results no longer repeat internal planning explanations.
});

test('自动参考是软目标，可为更多现有主料选择超过参考的菜数', async () => {
  const catalog = [simpleRecipe('a', [['chicken', 100], ['mushroom', 100], ['carrot', 100]], { category: 'meat' }),
    simpleRecipe('b', [['potato', 100], ['spinach', 100], ['cabbage', 100]]),
    simpleRecipe('c', [['tomato', 100], ['egg', 1], ['tofu', 100]]),
    simpleRecipe('d', [['broccoli', 100], ['cucumber', 100], ['peanut', 100]])];
  const result = await recommend(catalog, request());
  assert.equal(result.dishes.length, 4); assert.equal(result.target, 3);
});

test('未核实重量仍用于保守搭配估算，不伪造净量或可比单位', async () => {
  const catalog = Array.from({ length: 4 }, (_, i) => simpleRecipe(`p-${i}`, [['potato', 100]]));
  const m = mealWith('土豆150g'); m.ingredients[0].basis = 'unknown';
  const result = await recommend(catalog, request(m)); assert.equal(result.dishes.length, 1);
  assert.equal(result.checks[0].state, 'unverified'); assert.equal(result.checks[0].shortage, null);
  m.ingredients[0].amount = '';
  assert.equal((await recommend(catalog, request(m))).dishes.length, 3);
  m.ingredients[0].amount = '2个';
  assert.equal((await recommend(catalog, request(m))).dishes.length, 3);
});

test('自定义20道：库存不足说明，补买遵循指定数量而非候选六道，换菜保留19道', async () => {
  const catalog = Array.from({ length: 21 }, (_, i) => simpleRecipe(`egg-${String(i).padStart(2, '0')}`, [['egg', 1]]));
  const m = mealWith('鸡蛋2个'); m.composition = 'custom'; m.counts = { meat: 0, veg: 20, soup: 0 };
  const limited = await recommend(catalog, request(m)); assert.equal(limited.dishes.length, 2);
  assert(limited.reasons.some(r => r.includes('你指定了 20 道')));
  m.allowBuy = true; m.mode = 'candidates';
  const full = await recommend(catalog, request(m)); assert.equal(full.dishes.length, 20); assert(full.targetMet);
  assert.equal(new Set(full.dishes.map(d => d.recipe.id)).size, 20);
  assert.equal(full.checks.find(c => c.foodId === 'egg')?.shortage, 18);
  const selected = full.dishes.map(d => ({ recipeId: d.recipe.id, variantId: d.variant.id }));
  const replaced = await recommend(catalog, request(m, { action: 'replace', selected, replaceId: selected[0].recipeId }));
  assert.equal(replaced.dishes.length, 20); assert(!replaced.dishes.some(d => d.recipe.id === selected[0].recipeId));
  for (const s of selected.slice(1)) assert(replaced.dishes.some(d => d.recipe.id === s.recipeId && d.variant.id === s.variantId));
  m.counts.veg = 21; await assert.rejects(recommend(catalog, request(m)), /1～20/);
});

test('补买不越过内容类别与过敏限制，不通过重复菜谱凑20道', async () => {
  const m = mealWith('土豆200g'); m.allowBuy = true; m.composition = 'custom'; m.counts = { meat: 0, veg: 20, soup: 0 };
  const result = await recommend([simpleRecipe('a', [['potato', 100]])], request(m));
  assert.equal(result.dishes.length, 1); assert(!result.targetMet); assert(result.reasons.some(r => r.includes('目录外菜谱')));
  m.restrictions = [{ id: 'r', kind: 'allergy', name: '土豆', targets: ['potato'], status: 'confirmed', scope: 'self', original: '土豆' }];
  assert.equal(checkDish(simpleRecipe('a', [['potato', 100]]), simpleRecipe('a', [['potato', 100]]).variants[0], m).dish, undefined);
});

test('等价口味优化不丢失用量不同的变体，手选口味保留并复核整套库存', async () => {
  const a = simpleRecipe('a', [['egg', 2]]);
  a.variants.push({ ...a.variants[0], id: 'a-small', lines: [{ ...a.variants[0].lines[0], amount: 1 }] });
  const b = simpleRecipe('b', [['egg', 2]]);
  const m = mealWith('鸡蛋3个'); m.composition = 'custom'; m.counts = { meat: 0, veg: 2, soup: 0 };
  const full = await recommend([a, b], request(m));
  assert.equal(full.dishes.length, 2); assert.equal(full.dishes.find(d => d.recipe.id === 'a')?.variant.id, 'a-small');
  m.overrides.a = 'a-v';
  const chosen = await recommend([a, b], request(m)); assert.equal(chosen.dishes.length, 1);
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

test('D7-14: 1/2/3/12人使用同一菜谱整道量、营养与累计补买差额，不按人数或标准份数缩放', () => {
  const potato = foodById.get('potato')!, original = potato.nutrition;
  potato.nutrition = { kcal: 80, protein: 2, sodium: 5 };
  try {
    const a = simpleRecipe('a', [['potato', 100]], { servings: 4 });
    const b = simpleRecipe('b', [['potato', 50]], { servings: 2 });
    const m = mealWith('土豆120g'); m.allowBuy = true;
    for (const diners of [1, 2, 3, 12]) {
      m.servings = diners;
      const dishes = [a, b].map(r => checkDish(r, r.variants[0], m).dish!);
      assert.equal(dishes[0].checks[0].needed, 100);
      assert.deepEqual(dishes[0].nutrition, { kcal: 80, protein: 2, sodium: 5 });
      const set = checkSet(dishes, m); assert(set.valid);
      assert.equal(set.checks[0].needed, 150); assert.equal(set.checks[0].shortage, 30);
      m.allowBuy = false; assert.equal(checkSet(dishes, m).valid, false); m.allowBuy = true;
    }
  } finally { potato.nutrition = original; }
});

test('D7-14: 固定自定义菜数时，人数不影响选菜、口味、用量或库存结果', async () => {
  const catalog = Array.from({ length: 3 }, (_, i) => simpleRecipe(`p-${i}`, [['potato', 100]]));
  const m = mealWith('土豆300g'); m.composition = 'custom'; m.counts = { meat: 0, veg: 3, soup: 0 };
  const one = await recommend(catalog, request(m,{operationId:'fixed-order-for-servings'})); m.servings = 12;
  const twelve = await recommend(catalog, request(m,{operationId:'fixed-order-for-servings'}));
  assert.equal(twelve.dishes.length, 3); assert(twelve.targetMet);
  assert.deepEqual(twelve.dishes, one.dishes); assert.deepEqual(twelve.checks, one.checks);
  assert.equal(twelve.checks[0].needed, 300); assert.equal(twelve.checks[0].shortage, 0);
});
