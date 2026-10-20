import test from 'node:test';
import assert from 'node:assert/strict';
import { extractText, makeRestriction, mergeIngredients } from '../shared/extraction';
import { foodById, recipes, validateCatalog } from '../shared/catalog';
import { nutrition, parseQuantity, quantityCheck } from '../shared/quantity';
import { checkDish, checkSet, recommend } from '../server/recommendation';
import { verifyHealthRelease, type HealthRelease, type HealthRule } from '../server/health';
import { mealWith, request, simpleRecipe } from './fixtures';

test('AC-02: 连续中文拆分、约量与原文保留', () => {
  const x = extractText('西红柿2个鸡蛋3个菠菜一把');
  assert.deepEqual(x.ingredients.map(i => [i.name, i.amount]), [['西红柿', '2个'], ['鸡蛋', '3个'], ['菠菜', '一把']]);
  assert(x.ingredients.every(i => i.status === 'pending' && i.basis === 'unknown'));
  assert.equal(x.original, '西红柿2个鸡蛋3个菠菜一把');
});
test('AC-03: 混合类型、人数与疾病名称只形成候选', () => {
  const x = extractText('家里有番茄和鸡蛋，2个人吃，对虾过敏，有高血压和糖尿病');
  assert.deepEqual(x.ingredients.map(i => i.name), ['西红柿', '鸡蛋']);
  assert.equal(x.servings, 2); assert.deepEqual(x.restrictions[0].targets, ['shrimp']);
  assert.deepEqual(x.diseases.sort(), ['糖尿病', '高血压']);
});
test('AC-07: 否定与允许表达不能变成新过敏或清除旧限制', () => {
  const x = extractText('不对花生过敏，但鸡蛋可以吃');
  assert.equal(x.ingredients.length, 0);
  assert(x.restrictions.every(r => r.status === 'conflict' && r.kind === 'unclassified'));
});
test('连续食材后紧接过敏短语仍按类型拆分', () => {
  const x = extractText('鸡蛋3个西红柿500g虾300g海产品过敏');
  assert.equal(x.ingredients.length, 3); assert.equal(x.restrictions.length, 1);
  assert.equal(x.restrictions[0].name, '海产品');
});
test('AC-04: 同名数量冲突保留旧值不相加', () => {
  const m = mealWith('鸡肉300g');
  const merged = mergeIngredients(m.ingredients, extractText('鸡肉500g').ingredients);
  assert.equal(merged.length, 1); assert.equal(merged[0].amount, '300g');
  assert.equal(merged[0].status, 'conflict'); assert.match(merged[0].alternative!, /500g/);
});
test('AC-05: 未理解片段留待归类，不静默吞掉限制', () => {
  const x = extractText('鸡蛋，神秘食物，不能吃怪果');
  assert(x.unresolved.includes('神秘食物'));
  assert.equal(x.restrictions[0].status, 'unknown');
});
test('AC-09: 精确单位、选填、约量、无单位及精度', () => {
  assert.deepEqual(parseQuantity('0.5kg'), { amount: 500, unit: 'g' });
  assert.deepEqual(parseQuantity('1.5斤'), { amount: 750, unit: 'g' });
  for (const q of ['', '一把', '500', '-1g', '0g', '0.0001g', 'Infinityg']) assert.equal(parseQuantity(q), null);
});
test('AR-M01: 相同单位但毛净重、带骨、生熟或未知基准不可比较', () => {
  const r = simpleRecipe('a', [['chicken', 600]]), l = r.variants[0].lines[0];
  const i = mealWith('鸡肉600g').ingredients[0];
  for (const fields of [{ basis: 'as_purchased' as const }, { basis: 'unknown' as const }, { form: 'bone_in' }, { form: 'cooked' }, { form: 'skin_on' }]) {
    assert.equal(quantityCheck(l, 600, { ...i, ...fields }).state, 'unverified');
    assert.equal(quantityCheck(l, 600, { ...i, ...fields }).shortage, null);
  }
  assert.equal(quantityCheck(l, 600, i).state, 'enough');
});
test('B03 / AC-10: 鸡蛋克与个不可比较，允许推荐但结果标未核实', async () => {
  const m = mealWith('鸡蛋1g'); m.mode = 'candidates'; m.servings = 12;
  const res = await recommend([simpleRecipe('egg', [['egg', 1]])], request(m));
  assert.equal(res.status, 'completed'); assert.equal(res.dishes[0].checks[0].state, 'unverified');
  assert.match(res.dishes[0].checks[0].reason, /单位/);
});
test('B01 / D0-01: 未知过敏、忌口、未分类和待确认范围阻断', async () => {
  for (const kind of ['allergy', 'avoid', 'unclassified'] as const) {
    const m = mealWith(); m.restrictions = [makeRestriction('未知物', kind)];
    assert.equal((await recommend(recipes, request(m))).status, 'needs_confirmation');
  }
  const m = mealWith(); m.restrictions = [makeRestriction('海产品', 'allergy')];
  assert.equal((await recommend(recipes, request(m))).status, 'needs_confirmation');
});
test('AC-06 / AC-08: 已确认类别排除范围，本人与附加限制并集', async () => {
  const m = mealWith('虾500g鸡蛋10个'); m.mode = 'candidates'; m.allowBuy = true;
  m.restrictions = [{ ...makeRestriction('海产品', 'allergy', 'additional'), status: 'confirmed' }];
  assert((await recommend(recipes, request(m))).dishes.some(d => d.recipe.id === 'shrimp-egg'));
  m.includeAdditional = true;
  assert(!(await recommend(recipes, request(m))).dishes.some(d => d.variant.lines.some(l => l.foodId === 'shrimp' || l.foodId === 'fish')));
});
test('AC-12: 调味料库存关闭仍检查过敏成分与未知复合配料', () => {
  const m = mealWith(); m.checkSeasonings = false; m.restrictions = [{ ...makeRestriction('花生', 'allergy'), status: 'confirmed' }];
  const r = simpleRecipe('soy', [['egg', 1]]); r.variants[0].lines.push({ foodId: 'soy', amount: 5, unit: 'ml', role: 'seasoning', basis: 'edible', form: 'raw' });
  assert.equal(checkDish(r, r.variants[0], m).dish, undefined);
});
test('AC-11 / AC-12: 必需调料缺失排除，可省配料明确省略', () => {
  const m = mealWith(); m.checkSeasonings = true; m.seasonings = [];
  assert.equal(checkDish(recipes[0], recipes[0].variants[0], m).dish, undefined);
  m.allowBuy = true; const d = checkDish(recipes[0], recipes[0].variants[0], m).dish!;
  assert(d.checks.some(c => c.foodId === 'oil' && c.state === 'missing'));
  assert(d.omitted.includes('大蒜'));
});
test('B04 / AC-14: 非法人数及组合被服务端拒绝', async () => {
  for (const servings of [0, 1.5, 13, NaN]) await assert.rejects(recommend(recipes, request({ ...mealWith(), servings })), /人数/);
  await assert.rejects(recommend(recipes, request({ ...mealWith(), composition: 'custom', counts: { meat: 10, veg: 11, soup: 0 } })), /数量|合计/);
});
test('用户新确认: 默认一荤两素，库存不足按可行性调整', async () => {
  const full = await recommend(recipes, request());
  assert.equal(full.dishes.length, 3);
  assert.equal(full.dishes.filter(d => d.recipe.category === 'meat').length, 1);
  assert.equal(full.dishes.filter(d => d.recipe.category === 'veg').length, 2);
  const m = mealWith('土豆500g菠菜500g黄瓜500g');
  assert.equal((await recommend(recipes, request(m))).dishes.length, 3);
});
test('AC-10: 套餐累计库存不能由逐菜通过替代', async () => {
  const catalog = [simpleRecipe('a', [['egg', 2]]), simpleRecipe('b', [['egg', 2]])];
  const m = mealWith('鸡蛋3个'); m.composition = 'custom'; m.counts = { meat: 0, veg: 2, soup: 0 };
  const res = await recommend(catalog, request(m));
  assert.equal(res.dishes.length, 1); assert.equal(res.targetMet, false);
  assert.equal(checkSet(catalog.map(r => checkDish(r, r.variants[0], m).dish!), m).valid, false);
});
test('B06 / D7-14: 补买按固定菜谱量计算差额，不随12人放大', async () => {
  const m = mealWith('鸡肉1g香菇1g'); m.servings = 12; m.allowBuy = true; m.mode = 'candidates';
  const r = await recommend(recipes, request(m)); const d = r.dishes.find(d => d.recipe.id === 'chicken-mushroom')!;
  assert.equal(d.checks.find(c => c.foodId === 'chicken')?.shortage, 119);
  assert.equal(d.checks.find(c => c.foodId === 'mushroom')?.shortage, 59);
  m.ingredients.forEach(i => { i.basis = 'unknown'; });
  const unknown = await recommend(recipes, request(m));
  assert(unknown.dishes[0].checks.every(c => c.shortage === null));
});
test('AC-13: 套餐整体复用与候选逐道复用不同，盐油不充数', async () => {
  const catalog = [simpleRecipe('a', [['egg', 1]]), simpleRecipe('b', [['potato', 100]])];
  const m = mealWith('鸡蛋2个'); m.allowBuy = true; m.composition = 'custom'; m.counts = { meat: 0, veg: 2, soup: 0 };
  assert.equal((await recommend(catalog, request(m))).dishes.length, 2);
  m.mode = 'candidates'; m.composition = 'auto'; assert.equal((await recommend(catalog, request(m))).dishes.length, 1);
  const onlySalt = mealWith('盐10g'); onlySalt.allowBuy = true;
  assert.equal((await recommend(catalog, request(onlySalt))).dishes.length, 0);
});
test('AR-M02 / AC-17: 首批超过60个创意候选仍召回全部家常层，六张父菜谱分页', async () => {
  const catalog = [...Array.from({ length: 70 }, (_, i) => simpleRecipe(`creative-${i}`, [['egg', 1]], { homeStyle: false })), ...Array.from({ length: 8 }, (_, i) => simpleRecipe(`home-${i}`, [['egg', 1]]))];
  const m = mealWith('鸡蛋100个'); m.mode = 'candidates';
  const first = await recommend(catalog, request(m)); assert.equal(first.dishes.length, 6); assert(first.dishes.every(d => d.recipe.homeStyle));
  const next = await recommend(catalog, request(m, { action: 'page', page: 1, cursor: first.cursor }));
  assert.equal(next.dishes.filter(d => d.recipe.homeStyle).length, 2);
  assert(!next.dishes.some(d => first.dishes.some(x => x.recipe.id === d.recipe.id)));
  await assert.rejects(recommend(catalog, request({ ...m, servings: 2 }, { cursor: first.cursor })), /变化/);
  await assert.rejects(recommend(catalog, request(m, { page: 100 })), /超出/);
  catalog[0].state = 'withdrawn';
  await assert.rejects(recommend(catalog, request(m, { cursor: first.cursor })), /变化/);
});
test('AC-18: 单换固定其余菜，实际更新；重推存在替代时改变组合', async () => {
  const m = mealWith(); const first = await recommend(recipes, request(m));
  const selected = first.dishes.map(d => ({ recipeId: d.recipe.id, variantId: d.variant.id }));
  const second = await recommend(recipes, request(m, { action: 'replace', selected, replaceId: selected[1].recipeId }));
  assert.equal(second.dishes.length, 3); assert(!second.dishes.some(d => d.recipe.id === selected[1].recipeId));
  for (const i of [0, 2]) assert(second.dishes.some(d => d.recipe.id === selected[i].recipeId && d.variant.id === selected[i].variantId));
  const reroll = await recommend(recipes, request(m, { action: 'reroll', previous: selected.map(s => s.recipeId) }));
  assert.notEqual(reroll.dishes.map(d => d.recipe.id).sort().join(','), selected.map(s => s.recipeId).sort().join(','));
});
test('AC-19 / AC-20: 变体改变调料与步骤，手动口味优先且全套复核', async () => {
  const m = mealWith(); m.allowBuy = true; m.flavor = '清淡'; m.overrides['tomato-egg'] = 'tomato-egg-spicy'; m.mode = 'candidates';
  const page = await recommend(recipes, request(m));
  const d = page.dishes.find(d => d.recipe.id === 'tomato-egg');
  // If the recipe belongs on a later page, use a one-parent catalog to inspect the same path.
  const one = d ?? (await recommend([recipes[0]], request(m))).dishes[0];
  assert.equal(one.variant.flavor, '微辣'); assert(one.variant.lines.some(l => l.foodId === 'chilli'));
  assert.notDeepEqual(one.variant.steps, recipes[0].variants[0].steps);
  m.restrictions = [{ ...makeRestriction('干辣椒', 'avoid'), status: 'confirmed' }];
  assert.equal((await recommend([recipes[0]], request(m))).dishes.length, 0);
});
test('AR-O03 / D4-08: 搜索超限仍只发布已核验小套餐，不伪报无解；取消响应', async () => {
  const m = mealWith();
  const res = await recommend(recipes, request(m), { maxNodes: 3 });
  assert.equal(res.search, 'incomplete'); assert(res.dishes.length > 0); assert.equal(checkSet(res.dishes, m).valid, true);
  assert(res.reasons.some(r => r.includes('不代表无解')));
  const c = new AbortController(); c.abort();
  assert.equal((await recommend(recipes, request(m), { signal: c.signal })).status, 'cancelled');
});
test('撤回独立于固定内容版本，最终发布前再次核验', async () => {
  const catalog = [simpleRecipe('a', [['egg', 1]])];
  const res = await recommend(catalog, request(mealWith('鸡蛋2个')), { beforePublish: () => { catalog[0].state = 'withdrawn'; } });
  assert.equal(res.status, 'unavailable'); assert.equal(res.dishes.length, 0);
});
test('D4-09: 独立穷举小目录对照自定义组合和未知量', async () => {
  const catalog = [simpleRecipe('a', [['egg', 2]]), simpleRecipe('b', [['egg', 1], ['potato', 100]]), simpleRecipe('c', [['potato', 150]]), simpleRecipe('d', [['egg', 3]])];
  for (const eggs of [1, 2, 3, 4, 5, 6]) for (const potato of [100, 200, 300]) {
    const m = mealWith(`鸡蛋${eggs}个土豆${potato}g`); m.composition = 'custom'; m.counts = { meat: 0, veg: 2, soup: 0 };
    let expected = 0;
    for (let mask = 1; mask < 1 << catalog.length; mask++) {
      const chosen = catalog.filter((_, i) => mask & 1 << i); if (chosen.length > 2) continue;
      let eggNeed = 0, potatoNeed = 0;
      for (const r of chosen) for (const l of r.variants[0].lines) { if (l.foodId === 'egg') eggNeed += l.amount; else potatoNeed += l.amount; }
      if (eggNeed <= eggs && potatoNeed <= potato) expected = Math.max(expected, chosen.length);
    }
    const actual = await recommend(catalog, request(m)); assert.equal(actual.dishes.length, expected, `eggs=${eggs}, potato=${potato}`);
  }
});
test('D1-04: 单项营养缺失不以部分和冒充总量，完整项保留', () => {
  const egg = foodById.get('egg')!, potato = foodById.get('potato')!;
  const prevEgg = egg.nutrition, prevPotato = potato.nutrition;
  try {
    egg.nutrition = { kcal: 100, protein: 10 }; potato.nutrition = { protein: 2 };
    const r = simpleRecipe('n', [['egg', 1], ['potato', 100]]); r.variants[0].lines[0].edibleGrams = 50;
    const n = nutrition(r.variants[0].lines, 2);
    assert.equal(n.kcal, null); assert.equal(n.protein, 14); assert.equal(n.sodium, null);
  } finally { egg.nutrition = prevEgg; potato.nutrition = prevPotato; }
});
test('变体主料不可悄悄改变', () => {
  const r = simpleRecipe('v', [['egg', 1]]); r.variants.push({ ...r.variants[0], id: 'other', lines: simpleRecipe('p', [['potato', 10]]).variants[0].lines });
  assert.throws(() => validateCatalog([r]), /main ingredients/);
});
test('AR-M04: 完整规则发布绑定、漏项、混版、组合、条件与撤回负例', () => {
  const release: HealthRelease = { id: 'release1', diseases: ['test'], status: 'approved', reviewer: 'test reviewer', rules: [{ id: 'r1', version: 'v1', evidenceVersion: 'e1' }, { id: 'r2', version: 'v1', evidenceVersion: 'e2' }] };
  const rules: HealthRule[] = release.rules.map(r => ({ ...r, status: 'approved' }));
  const check = (r = rules, revoked = new Set<string>(), ds = ['test'], c = {}) => verifyHealthRelease(release, ds, r, revoked, c);
  assert.equal(check().state, 'verified'); assert.equal(check(rules.slice(0, 1)).state, 'unavailable');
  assert.equal(check([{ ...rules[0], version: 'v2' }, rules[1]]).state, 'unavailable');
  assert.equal(check(rules, new Set(['e1'])).state, 'unavailable'); assert.equal(check(rules, new Set(), ['test', 'second']).state, 'unavailable');
  rules[0].condition = 'required'; assert.equal(check().state, 'needs_confirmation');
  assert.equal(check(rules, new Set(), ['test'], { required: 'unknown' }).state, 'needs_confirmation');
});
