import { createHmac, randomBytes } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { foodById, restrictionTargets } from '../shared/catalog';
import { inventoryChecks, nutrition } from '../shared/quantity';
import { CONTENT_VERSION, type Dish, type Line, type Meal, type Recipe, type RecommendationRequest, type RecommendationResult, type Variant } from '../shared/types';

const cursorSecret = randomBytes(32);
export const fingerprint = (value: unknown, key: Uint8Array = cursorSecret) => createHmac('sha256', key).update(JSON.stringify(value)).digest('hex');
export class DomainError extends Error {
  constructor(public code: string, public statusCode: number, message: string) { super(message); }
}
export function assertMeal(meal: Meal) {
  if (!Number.isInteger(meal.servings) || meal.servings < 1 || meal.servings > 12) throw new DomainError('INVALID_SERVINGS', 400, '人数须为 1～12 的整数');
  const counts = Object.values(meal.counts);
  if (counts.some(n => !Number.isInteger(n) || n < 0 || n > 6) || counts.reduce((a, b) => a + b, 0) < 1 || counts.reduce((a, b) => a + b, 0) > 6) throw new DomainError('INVALID_COMPOSITION', 400, '请明确填写荤、素、汤数量，总数须为 1～6');
  const ids = new Set<string>();
  for (const i of meal.ingredients.filter(i => i.status === 'confirmed')) {
    if (!i.foodId || !foodById.has(i.foodId) || ids.has(i.foodId)) throw new DomainError('INVALID_INGREDIENT', 400, '食材须属于目录且同名项已合并');
    ids.add(i.foodId);
  }
  for (const r of meal.restrictions) if (r.status === 'confirmed') {
    const expected = restrictionTargets(r.name);
    if (r.kind === 'unclassified' || !expected.length || fingerprint([...expected].sort()) !== fingerprint([...r.targets].sort())) throw new DomainError('INVALID_RESTRICTION', 400, '限制名称及范围需要重新核对');
  }
}
function activeRestrictions(meal: Meal) { return meal.restrictions.filter(r => r.scope === 'self' || meal.includeAdditional); }
function blockedFood(foodId: string, targets: Set<string>) {
  const f = foodById.get(foodId)!;
  if (!targets.size) return false;
  if (!f.componentsComplete) return true;
  if (targets.has(foodId)) return true;
  const allergens = new Set([...targets].flatMap(t => foodById.get(t)?.allergens ?? []));
  return f.allergens.some(a => allergens.has(a));
}
function actualLines(variant: Variant, meal: Meal) {
  const omitted: string[] = [];
  const lines = variant.lines.filter(l => {
    if (l.optional && meal.checkSeasonings && !meal.seasonings.includes(l.foodId)) { omitted.push(foodById.get(l.foodId)!.name); return false; }
    return true;
  });
  return { lines, omitted };
}
export function checkDish(recipe: Recipe, variant: Variant, meal: Meal): { dish?: Dish; reasons: string[] } {
  if (recipe.state !== 'published') return { reasons: ['菜谱已停用'] };
  const targets = new Set(activeRestrictions(meal).flatMap(r => r.targets));
  const { lines, omitted } = actualLines(variant, meal);
  const restricted = lines.find(l => blockedFood(l.foodId, targets));
  if (restricted) return { reasons: [`${recipe.name}：${foodById.get(restricted.foodId)!.name}触及限制或成分无法核验`] };
  const checks = inventoryChecks(lines, meal.servings / recipe.servings, meal);
  const shortage = checks.filter(c => c.state === 'shortage' || c.state === 'missing');
  if (!meal.allowBuy && shortage.length) return { reasons: shortage.map(c => `${c.name}：${c.reason}`) };
  const present = new Set(meal.ingredients.filter(i => i.status === 'confirmed').map(i => i.foodId));
  const reused = lines.filter(l => l.role === 'main' && present.has(l.foodId)).map(l => l.foodId);
  return { dish: { recipe, variant, checks, reused, omitted, nutrition: nutrition(lines, meal.servings / recipe.servings) }, reasons: [] };
}
function allLines(dishes: Dish[], meal: Meal): Line[] {
  return dishes.flatMap(d => actualLines(d.variant, meal).lines.map(l => ({ ...l, amount: l.amount / d.recipe.servings })));
}
export function checkSet(dishes: Dish[], meal: Meal) {
  const checks = inventoryChecks(allLines(dishes, meal), meal.servings, meal);
  const shortages = checks.some(c => c.state === 'missing' || c.state === 'shortage');
  return { checks, valid: (!shortages || meal.allowBuy) && dishes.some(d => d.reused.length > 0) };
}
const buying = (d: Dish) => d.checks.filter(c => c.state === 'missing' || c.state === 'shortage').length;
function compareDish(a: Dish, b: Dish) {
  return Number(b.recipe.homeStyle) - Number(a.recipe.homeStyle) || buying(a) - buying(b) || a.recipe.id.localeCompare(b.recipe.id);
}
export async function recommend(catalog: Recipe[], req: RecommendationRequest, options: { signal?: AbortSignal; maxNodes?: number; deadlineMs?: number; beforePublish?: () => void } = {}): Promise<RecommendationResult> {
  const start = performance.now(), meal = req.meal;
  assertMeal(meal);
  const target = meal.mode === 'candidates' ? 6 : meal.composition === 'auto' ? 3 : Object.values(meal.counts).reduce((a, b) => a + b, 0);
  const cursor = fingerprint({ meal: { ...meal, version: 0 }, content: CONTENT_VERSION, catalog });
  if (req.cursor && req.cursor !== cursor) throw new DomainError('CURSOR_EXPIRED', 409, '条件、内容或服务会话已变化，请重新生成第一页');
  let nodes = 0;
  const result = (values: Partial<RecommendationResult>): RecommendationResult => ({
    operationId: req.operationId, mealVersion: meal.version, contentVersion: CONTENT_VERSION,
    status: 'completed', search: 'complete', target, targetMet: false,
    dishes: [], checks: [], reasons: [], total: 0, page: req.page, cursor, nodes, changed: true,
    elapsedMs: Math.round((performance.now() - start) * 100) / 100, ...values,
  });
  const pending = activeRestrictions(meal).filter(r => r.status !== 'confirmed');
  if (pending.length) return result({ status: 'needs_confirmation', reasons: pending.map(r => `请核对限制：${r.name}`) });
  if (meal.ingredients.some(i => i.status === 'conflict')) return result({ status: 'needs_confirmation', reasons: ['同名食材数量或计量基准冲突，请逐项核对'] });
  if (!meal.ingredients.some(i => i.status === 'confirmed' && i.foodId)) return result({ status: 'needs_confirmation', reasons: ['请至少确认一种现有食材'] });
  if (meal.health) return result({ status: 'unavailable', reasons: ['真实账户与经审核的健康规则尚未准入，当前不提供健康推荐。可主动返回普通模式，过敏与忌口继续生效。'] });
  if (options.signal?.aborted) return result({ status: 'cancelled', search: 'incomplete', reasons: ['操作已取消'] });

  const pool: Dish[] = [], exclusions = new Set<string>();
  for (const r of catalog) {
    const override = meal.overrides[r.id];
    const variants = override ? r.variants.filter(v => v.id === override) : r.variants.filter(v => meal.flavor === '不限' || v.flavor === meal.flavor);
    for (const v of variants) {
      const checked = checkDish(r, v, meal);
      if (checked.dish) pool.push(checked.dish);
      for (const reason of checked.reasons) exclusions.add(reason);
    }
  }
  // Complete structured qualification precedes business ordering and parent grouping (AR-M02).
  pool.sort(compareDish);
  const grouped = [...new Set(pool.map(d => d.recipe.id))].map(id => pool.find(d => d.recipe.id === id)!);
  if (meal.mode === 'candidates') {
    const candidates = grouped.filter(d => d.reused.length > 0);
    if (candidates.length && req.page * 6 >= candidates.length) throw new DomainError('PAGE_EXPIRED', 409, '当前页超出结果范围，请重新生成第一页');
    const dishes = candidates.slice(req.page * 6, req.page * 6 + 6);
    options.beforePublish?.();
    if (dishes.some(d => !checkDish(d.recipe, d.variant, meal).dish)) return result({ status: 'unavailable', reasons: ['内容在发布前变化，请重新核对'] });
    return result({ status: dishes.length ? 'completed' : 'no_results', targetMet: dishes.length === 6, dishes, total: candidates.length,
      reasons: dishes.length ? [] : ['此构造目录内未找到符合当前条件的候选', ...[...exclusions].slice(0, 5)] });
  }

  const lockedIds = req.action === 'replace' ? req.selected.filter(d => d.recipeId !== req.replaceId) : req.action === 'variant' ? req.selected : [];
  if (req.action === 'replace' && (!req.replaceId || !req.selected.some(s => s.recipeId === req.replaceId))) throw new DomainError('INVALID_REPLACEMENT', 400, '请指定要替换的菜');
  if (new Set(lockedIds.map(s => s.recipeId)).size !== lockedIds.length) throw new DomainError('DUPLICATE_SELECTION', 400, '已选菜谱不能重复');
  const locked: Dish[] = [];
  for (const s of lockedIds) {
    const chosenId = meal.overrides[s.recipeId] ?? s.variantId;
    const d = pool.find(d => d.recipe.id === s.recipeId && d.variant.id === chosenId);
    if (!d) return result({ status: 'needs_confirmation', reasons: ['保留菜或所选口味不符合当前条件，请调整后重新生成'], changed: false });
    locked.push(d);
  }
  const effectiveTarget = req.action === 'replace' || req.action === 'variant' ? req.selected.length : target;
  const remaining = pool.filter(d => !locked.some(k => k.recipe.id === d.recipe.id) && (req.action !== 'replace' || d.recipe.id !== req.replaceId));
  let best: Dish[] = [], bestScore = -Infinity, incomplete = false;
  const previousSet = [...req.previous].sort().join(',');
  const maxNodes = options.maxNodes ?? 20_000, deadline = start + (options.deadlineMs ?? 1500);
  const counts = (set: Dish[]) => ({ meat: set.filter(d => d.recipe.category === 'meat').length, veg: set.filter(d => d.recipe.category === 'veg').length, soup: set.filter(d => d.recipe.category === 'soup').length });
  const accept = (set: Dish[]) => {
    if (!set.length || !checkSet(set, meal).valid) return;
    if ((req.action === 'replace' || req.action === 'variant') && set.length !== effectiveTarget) return;
    if (req.action === 'reroll' && set.map(d => d.recipe.id).sort().join(',') === previousSet) return;
    const c = counts(set);
    const distance = meal.composition === 'auto' ? Math.abs(c.meat - 1) + Math.abs(c.veg - 2) + c.soup : 0;
    const buyItems = checkSet(set, meal).checks.filter(c => c.state === 'missing' || c.state === 'shortage').length;
    const score = set.length * 1_000_000 - distance * 10_000 + set.filter(d => d.recipe.homeStyle).length * 100 - buyItems;
    if (score > bestScore) { best = [...set]; bestScore = score; }
  };
  const visit = async (set: Dish[], from: number): Promise<void> => {
    if (++nodes > maxNodes || performance.now() > deadline) { incomplete = true; return; }
    if (options.signal?.aborted) return;
    if (nodes % 128 === 0) await setImmediate();
    accept(set);
    if (set.length >= effectiveTarget) return;
    for (let i = from; i < remaining.length; i++) {
      if (incomplete || options.signal?.aborted) break;
      const d = remaining[i];
      if (set.some(x => x.recipe.id === d.recipe.id)) continue;
      const next = [...set, d];
      const c = counts(next);
      if (meal.composition === 'custom' && (['meat', 'veg', 'soup'] as const).some(k => c[k] > meal.counts[k])) continue;
      // Safe pruning uses cumulative shortages only. Unknown quantities never prune.
      const checks = checkSet(next, meal).checks;
      if (!meal.allowBuy && checks.some(c => c.state === 'shortage' || c.state === 'missing')) continue;
      await visit(next, i + 1);
    }
  };
  await visit(locked, 0);
  if (options.signal?.aborted) return result({ status: 'cancelled', search: 'incomplete', reasons: ['操作已取消'] });
  options.beforePublish?.();
  if (best.some(d => !checkDish(d.recipe, d.variant, meal).dish) || (best.length && !checkSet(best, meal).valid)) return result({ status: 'unavailable', reasons: ['内容在最终检查前变化，请重新生成'] });
  const replacingFailed = !best.length && (req.action === 'replace' || req.action === 'reroll' || req.action === 'variant');
  return result({ dishes: best, checks: best.length ? checkSet(best, meal).checks : [], total: grouped.length,
    status: best.length ? 'completed' : incomplete ? 'unavailable' : 'no_results', search: incomplete ? 'incomplete' : 'complete', target: effectiveTarget,
    targetMet: best.length === effectiveTarget, changed: !replacingFailed,
    reasons: [
      ...(incomplete ? ['本次搜索预算已用完，搜索未完成；未找到目标数量不代表无解'] : []),
      ...(!best.length ? [replacingFailed ? '当前范围内没有其他可行方案，保留原方案' : '此构造目录内没有满足当前条件的套餐', ...[...exclusions].slice(0, 5)] : []),
      ...(best.length && best.length < effectiveTarget ? [`目标 ${effectiveTarget} 道，本次核验 ${best.length} 道；未自动补买或放宽限制`] : []),
    ],
  });
}
