import { createHmac, randomBytes } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { constructedContent } from '../shared/catalog';
import { availableFlavors } from '../shared/flavors';
import { verifiedComposition } from './composition-review';
import { matchesListedFood } from '../shared/food-restrictions';
import type { ContentContext } from '../shared/content';
import { inventoryChecks, nutrition } from '../shared/quantity';
import { findPantryIngredient, resolvePantryFood } from '../shared/ingredient-matching';
import { seasoningStockKey } from '../shared/pantry';
import { compositionError, estimatedShortages, MAX_DISHES, servingReference } from '../shared/meal-planning';
import { type Dish, type Line, type Meal, type Recipe, type RecommendationRequest, type RecommendationResult, type Variant } from '../shared/types';

const cursorSecret = randomBytes(32);
export const fingerprint = (value: unknown, key: Uint8Array = cursorSecret) => createHmac('sha256', key).update(JSON.stringify(value)).digest('hex');
export class DomainError extends Error {
  constructor(public code: string, public statusCode: number, message: string) { super(message); }
}
export function assertMeal(meal: Meal, context: ContentContext = constructedContent) {
  if (meal.flavor !== '不限' && !availableFlavors(context.recipes).includes(meal.flavor)) throw new DomainError('INVALID_FLAVOR', 400, '所选口味不在当前菜谱目录中，请重新选择');
  if (!Number.isInteger(meal.servings) || meal.servings < 1 || meal.servings > 12) throw new DomainError('INVALID_SERVINGS', 400, '人数须为 1～12 的整数');
  const countError = compositionError(meal);
  if (countError) throw new DomainError('INVALID_COMPOSITION', 400, countError);
  const ids = new Set<string>();
  for (const i of meal.ingredients.filter(i => i.status === 'confirmed')) {
    const recognized = i.foodId && (context.foodById.has(i.foodId) || resolvePantryFood(i.name, context.foodById)?.id === i.foodId);
    if (!recognized || !i.foodId || ids.has(i.foodId)) throw new DomainError('INVALID_INGREDIENT', 400, '食材须属于目录或可匹配的食材名称，且同名项已合并');
    ids.add(i.foodId);
  }
  for (const r of meal.restrictions) if (r.status === 'confirmed') {
    const expected = context.restrictionTargets(r.name);
    if (r.kind === 'unclassified' || !expected.length || fingerprint([...expected].sort()) !== fingerprint([...r.targets].sort())) throw new DomainError('INVALID_RESTRICTION', 400, '限制名称及范围需要重新核对');
  }
}
function activeRestrictions(meal: Meal) { return meal.restrictions.filter(r => r.scope === 'self' || meal.includeAdditional); }
function restrictedAllergens(targets:Set<string>,context:ContentContext){
  const identities=context.verifiedIngredientIdentities??[];
  return new Set([...targets].flatMap(id=>[...(context.foodById.get(id)?.allergens??[]),...(identities.find(item=>item.foodId===id)?.allergens??[])]));
}
function knownRestrictedFood(foodId:string,targets:Set<string>,context:ContentContext,review?:ReturnType<typeof verifiedComposition>){
  const allergens=restrictedAllergens(targets,context);
  const identity=context.verifiedIngredientIdentities?.find(item=>item.foodId===foodId);
  return context.components(foodId).some(food=>targets.has(food.id)||food.allergens.some(id=>allergens.has(id)))
    ||Boolean(identity&&(identity.identityId&&targets.has(identity.identityId)||identity.allergens.some(id=>allergens.has(id))))
    ||review?.leaves.find(leaf=>leaf.foodId===foodId&&leaf.verified!==false)?.equivalentIds.some(id=>targets.has(id));
}
function blockedFood(foodId: string, targets: Set<string>, context: ContentContext, review?: ReturnType<typeof verifiedComposition>) {
  const f = context.foodById.get(foodId)!;
  if (!targets.size) return false;
  // Allergy/avoidance checks compare the ingredients explicitly listed for
  // this variant with the restriction targets. Recipe provenance/completeness
  // and nutrition review are separate concerns and must not veto an unrelated
  // restriction. Target-specific unknown product components still fail closed.
  const leaf = review?.leaves.find(leaf => leaf.foodId === foodId&&leaf.verified!==false);
  const uncertainty=context.uncertainComponents?.filter(item=>item.foodId===foodId);
  const identity=context.verifiedIngredientIdentities?.some(item=>item.foodId===foodId);
  const unresolved=context.unresolvedComponents?.includes(foodId);
  const uncertaintyApplies=!uncertainty?.length||uncertainty.some(item=>item.targetIds.some(id=>targets.has(id)));
  if(unresolved&&uncertaintyApplies)return true;
  if (!f.componentsComplete && !leaf && !identity && uncertaintyApplies
      && (unresolved || uncertainty?.length)) return true;
  if (context.components(foodId).some(f => targets.has(f.id)) || leaf?.equivalentIds.some(id => targets.has(id))) return true;
  const allergens = restrictedAllergens(targets,context);
  return context.components(foodId).some(food => {
    const uncertain=context.uncertainComponents?.filter(item=>item.foodId===food.id);
    const applies=!uncertain?.length||uncertain.some(item=>item.targetIds.some(id=>targets.has(id)));
    return context.unresolvedComponents?.includes(food.id)&&applies
      || (!food.componentsComplete && applies && (context.unresolvedComponents?.includes(food.id)
        || context.uncertainComponents?.some(item=>item.foodId===food.id&&item.targetIds.some(id=>targets.has(id))))
        && !context.verifiedIngredientIdentities?.some(item=>item.foodId===food.id) && !review?.leaves.some(leaf => leaf.foodId === food.id&&leaf.verified!==false))
      || food.allergens.some(a => allergens.has(a));
  });
}
function actualLines(variant: Variant, meal: Meal, context: ContentContext) {
  const omitted: string[] = [];
  const lines = variant.lines.filter(l => {
    if (l.optional && l.role !== 'seasoning' && !findPantryIngredient(l, meal.ingredients, context.foodById)) { omitted.push(context.foodById.get(l.foodId)!.name); return false; }
    if (l.optional && l.role === 'seasoning' && meal.checkSeasonings && !meal.seasonings.some(id=>context.foodById.has(id)&&seasoningStockKey(context.foodById.get(id)!)===seasoningStockKey(context.foodById.get(l.foodId)!))) { omitted.push(context.foodById.get(l.foodId)!.name); return false; }
    return true;
  });
  return { lines, omitted };
}
export function checkDish(recipe: Recipe, variant: Variant, meal: Meal, context: ContentContext = constructedContent): { dish?: Dish; reasons: string[] } {
  if (recipe.state !== 'published') return { reasons: ['菜谱已停用'] };
  const targets = new Set(activeRestrictions(meal).flatMap(r => r.targets));
  if(context.restrictionScope==='listed-foods'){
    const targetFoods=[...targets].flatMap(id=>context.foodById.get(id)?[context.foodById.get(id)!]:[]);
    const listed=variant.lines.find(line=>matchesListedFood(context.foodById.get(line.foodId)!,targetFoods));
    if(listed)return {reasons:[`${recipe.name}：含有需避开的${context.foodById.get(listed.foodId)!.name}`]};
  }
  const review = targets.size && context.restrictionScope!=='listed-foods' ? verifiedComposition(recipe, variant, context) : undefined;
  const { lines, omitted } = actualLines(variant, meal, context);
  const known=targets.size&&context.restrictionScope!=='listed-foods'?lines.find(line=>knownRestrictedFood(line.foodId,targets,context,review)):undefined;
  if(known)return {reasons:[`${recipe.name}：含有需避开的${context.foodById.get(known.foodId)!.name}`]};
  const restricted = context.restrictionScope==='listed-foods'?undefined:lines.find(l => blockedFood(l.foodId, targets, context, review));
  if (restricted) return { reasons: [`${recipe.name}：${context.foodById.get(restricted.foodId)!.name}的配料信息不完整`] };
  const checks = inventoryChecks(lines, 1, meal, context.foodById);
  const shortage = checks.filter(c => c.state === 'shortage' || c.state === 'missing');
  if (!meal.allowBuy && shortage.length) return { reasons: shortage.map(c => `${c.name}：${c.reason}`) };
  const estimated = estimatedShortages(checks, meal);
  if (!meal.allowBuy && estimated.length) return { reasons: estimated.map(c => `${c.name}：按填写用量估算不足，重量基准尚未核实`) };
  const reused = lines.filter(l => l.role === 'main' && !l.optional && findPantryIngredient(l, meal.ingredients, context.foodById)).map(l => l.foodId);
  return { dish: { recipe, variant, checks, reused, omitted, nutrition: nutrition(lines, 1, context.foodById) }, reasons: [] };
}
function allLines(dishes: Dish[], meal: Meal, context: ContentContext): Line[] {
  return dishes.flatMap(d => actualLines(d.variant, meal, context).lines);
}
export function checkSet(dishes: Dish[], meal: Meal, context: ContentContext = constructedContent) {
  const checks = inventoryChecks(allLines(dishes, meal, context), 1, meal, context.foodById);
  const shortages = checks.some(c => c.state === 'missing' || c.state === 'shortage');
  return { checks, valid: (meal.allowBuy || (!shortages && !estimatedShortages(checks, meal).length)) && (dishes.some(d => d.reused.length > 0) || buyWithoutInventory(meal)) };
}
// With explicit buying consent and no declared ingredients, offer a shopping-first plan.
function buyWithoutInventory(meal: Meal) { return meal.allowBuy && meal.ingredients.length === 0; }
const buying = (d: Dish) => d.checks.filter(c => c.state === 'missing' || c.state === 'shortage').length;
function compareDish(a: Dish, b: Dish) {
  return Number(b.recipe.homeStyle) - Number(a.recipe.homeStyle) || buying(a) - buying(b);
}
function candidateRelevance(dish: Dish, meal: Meal, context: ContentContext) {
    const main = actualLines(dish.variant, meal, context).lines.filter(line => line.role === 'main' && !line.optional);
    const uniqueMain = [...new Map(main.map(line => [line.foodId, line])).values()];
    const matches = uniqueMain.map(line => ({ line, match: findPantryIngredient(line, meal.ingredients, context.foodById) })).filter(item => item.match);
    const exact = matches.filter(item => item.match?.kind === 'exact').length;
    return { matched: matches.length, total: uniqueMain.length, exact, homeStyle:Number(dish.recipe.homeStyle),buying:buying(dish) };
}
function compareCandidateRelevance(left:ReturnType<typeof candidateRelevance>,right:ReturnType<typeof candidateRelevance>) {
  return right.matched - left.matched
    || right.matched / Math.max(right.total, 1) - left.matched / Math.max(left.total, 1)
    || right.exact - left.exact
    || right.homeStyle-left.homeStyle || left.buying-right.buying;
}
export async function recommend(catalog: Recipe[], req: RecommendationRequest, options: { signal?: AbortSignal; maxNodes?: number; deadlineMs?: number; beforePublish?: () => void; localHealthTest?: boolean; context?: ContentContext; cursorSecret?: Uint8Array } = {}): Promise<RecommendationResult> {
  const start = performance.now(), meal = req.meal, context = options.context ?? constructedContent;
  const sign = (value: unknown) => fingerprint(value, options.cursorSecret ?? cursorSecret);
  assertMeal(meal, context);
  const candidateMode = meal.mode === 'candidates' && meal.composition === 'auto';
  const guide = servingReference(meal.servings);
  const target = candidateMode ? 6 : meal.composition === 'auto' ? guide.total : Object.values(meal.counts).reduce((a, b) => a + b, 0);
  // Each generation has a new ordering; subsequent pages carry the same seed in
  // a signed cursor. Personal conditions/content still invalidate that cursor.
  const variation = req.cursor?.split('.')[0] ?? sign(req.operationId).slice(0,16);
  const cursor = `${variation}.${sign({ variation, meal: { ...meal, version: 0 }, content: context.contentVersion, catalog })}`;
  if (req.cursor && req.cursor !== cursor) throw new DomainError('CURSOR_EXPIRED', 409, '条件、内容或服务会话已变化，请重新生成第一页');
  const rank = (value: unknown) => parseInt(sign({ variation, value }).slice(0,8),16) / 0x1_0000_0000;
  const dishRanks=new Map<string,number>();
  const dishRank=(id:string)=>{if(!dishRanks.has(id))dishRanks.set(id,rank(id));return dishRanks.get(id)!;};
  const variedOrder = (a: Dish, b: Dish) => dishRank(a.recipe.id) - dishRank(b.recipe.id);
  const businessOrder = (a: Dish, b: Dish) => compareDish(a,b) || variedOrder(a,b);
  let nodes = 0;
  const result = (values: Partial<RecommendationResult>): RecommendationResult => ({
    operationId: req.operationId, mealVersion: meal.version, contentVersion: context.contentVersion,
    status: 'completed', search: 'complete', target, targetMet: false,
    dishes: [], checks: [], reasons: [], total: 0, page: req.page, cursor, nodes, changed: true,
    elapsedMs: Math.round((performance.now() - start) * 100) / 100, ...values,
    ...(meal.health && options.localHealthTest ? { healthAssessment: { state: 'test_only' as const, message: '健康模式测试：当前仅验证设置与推荐流程，尚未按疾病规则筛选菜谱。' } } : {}),
  });
  const pending = activeRestrictions(meal).filter(r => r.status !== 'confirmed');
  if (pending.length) return result({ status: 'needs_confirmation', reasons: pending.map(r => `请核对限制：${r.name}`) });
  if (meal.ingredients.some(i => i.status === 'conflict')) return result({ status: 'needs_confirmation', reasons: ['同名食材数量或计量基准冲突，请逐项核对'] });
  if (!meal.ingredients.some(i => i.status === 'confirmed' && i.foodId) && !buyWithoutInventory(meal)) return result({ status: 'needs_confirmation', reasons: ['请至少确认一种现有食材；也可允许补买后查看默认推荐'] });
  if (meal.health && !options.localHealthTest) return result({ status: 'unavailable', reasons: ['真实账户与经审核的健康规则尚未准入，当前不提供健康推荐。可主动返回普通模式，过敏与忌口继续生效。'] });
  if (options.signal?.aborted) return result({ status: 'cancelled', search: 'incomplete', reasons: ['操作已取消'] });

  const pool: Dish[] = [];
  for (const r of catalog) {
    const override = meal.overrides[r.id];
    const variants = override ? r.variants.filter(v => v.id === override) : r.variants.filter(v => meal.flavor === '不限' || v.flavor === meal.flavor);
    for (const v of variants) {
      const checked = checkDish(r, v, meal, context);
      if (checked.dish) pool.push(checked.dish);
    }
  }
  // Complete structured qualification precedes business ordering and parent grouping (AR-M02).
  // Request-local scores avoid repeating ingredient matching inside every sort comparison.
  // All dishes were freshly checked above; nothing is reused across requests.
  const relevance=candidateMode?new Map(pool.map(d=>[d,candidateRelevance(d,meal,context)])):null;
  pool.sort(relevance ? (a, b) => compareCandidateRelevance(relevance.get(a)!,relevance.get(b)!) || variedOrder(a,b) : businessOrder);
  const byRecipe=new Map<string,Dish>();
  for(const dish of pool)if(!byRecipe.has(dish.recipe.id))byRecipe.set(dish.recipe.id,dish);
  const grouped = [...byRecipe.values()];
  if(req.action==='variant'){
    if(!req.selected.length||new Set(req.selected.map(s=>s.recipeId)).size!==req.selected.length)throw new DomainError('INVALID_SELECTION',400,'请重新选择要查看的菜谱');
    const dishes=req.selected.map(s=>pool.find(d=>d.recipe.id===s.recipeId&&d.variant.id===(meal.overrides[s.recipeId]??s.variantId)));
    const retained=dishes.filter((d):d is Dish=>!!d);
    const rejected=()=>result({status:'needs_confirmation',changed:false,reasons:['这个口味暂不适合当前搭配，已保留原口味。']});
    if(retained.length!==dishes.length||candidateMode&&retained.some(d=>!d.reused.length&&!buyWithoutInventory(meal))||!candidateMode&&!checkSet(retained,meal,context).valid)return rejected();
    options.beforePublish?.();
    if(retained.some(d=>!checkDish(d.recipe,d.variant,meal,context).dish)||!candidateMode&&!checkSet(retained,meal,context).valid)return rejected();
    return result({dishes:retained,checks:candidateMode?[]:checkSet(retained,meal,context).checks,
      total:candidateMode?grouped.filter(d=>d.reused.length>0||buyWithoutInventory(meal)).length:retained.length,target:req.selected.length,targetMet:true});
  }
  if (candidateMode) {
    const candidates = grouped.filter(d => d.reused.length > 0 || buyWithoutInventory(meal));
    if (candidates.length && req.page * 6 >= candidates.length) throw new DomainError('PAGE_EXPIRED', 409, '当前页超出结果范围，请重新生成第一页');
    const dishes = candidates.slice(req.page * 6, req.page * 6 + 6);
    options.beforePublish?.();
    if (dishes.some(d => !checkDish(d.recipe, d.variant, meal, context).dish)) return result({ status: 'unavailable', reasons: ['内容在发布前变化，请重新核对'] });
    return result({ status: dishes.length ? 'completed' : 'no_results', targetMet: dishes.length === 6, dishes, total: candidates.length,
      reasons: dishes.length ? [] : ['暂时没有找到合适的菜谱，可以调整食材或口味后再试。'] });
  }

  const lockedIds = req.action === 'replace' ? req.selected.filter(d => d.recipeId !== req.replaceId) : [];
  if (req.action === 'replace' && (!req.replaceId || !req.selected.some(s => s.recipeId === req.replaceId))) throw new DomainError('INVALID_REPLACEMENT', 400, '请指定要替换的菜');
  if (new Set(lockedIds.map(s => s.recipeId)).size !== lockedIds.length) throw new DomainError('DUPLICATE_SELECTION', 400, '已选菜谱不能重复');
  const locked: Dish[] = [];
  for (const s of lockedIds) {
    const chosenId = meal.overrides[s.recipeId] ?? s.variantId;
    const d = pool.find(d => d.recipe.id === s.recipeId && d.variant.id === chosenId);
    if (!d) return result({ status: 'needs_confirmation', reasons: ['保留菜或所选口味不符合当前条件，请调整后重新生成'], changed: false });
    locked.push(d);
  }
  const effectiveTarget = req.action === 'replace' ? req.selected.length : target;
  if (effectiveTarget > MAX_DISHES) throw new DomainError('INVALID_COMPOSITION', 400, '一餐最多搭配 20 道菜');
  const automatic = meal.composition === 'auto' && req.action !== 'replace';
  const searchLimit = automatic ? MAX_DISHES : effectiveTarget;
  const footprints = new Set<string>();
  const remaining = pool.filter(d => {
    if (locked.some(k => k.recipe.id === d.recipe.id) || (req.action === 'replace' && d.recipe.id === req.replaceId)) return false;
    if (meal.composition === 'custom' && meal.counts[d.recipe.category] === 0) return false;
    // Only equivalent selectable variants of the same parent are interchangeable.
    // Manual flavor overrides were already applied; locked variants are retained above.
    const footprint = sign({ parent: d.recipe.id,
      lines: actualLines(d.variant, meal, context).lines.filter(l => l.role !== 'seasoning'),
      missingSeasonings: d.checks.filter(c => c.unit === '有无').map(c => c.foodId).sort() });
    if (footprints.has(footprint)) return false;
    footprints.add(footprint); return true;
  });
  let best: Dish[] = [], bestScore = -Infinity, incomplete = false;
  const previousSet = [...req.previous].sort().join(',');
  const maxNodes = options.maxNodes ?? 20_000, deadline = start + (options.deadlineMs ?? 1500);
  const counts = (set: Dish[]) => ({ meat: set.filter(d => d.recipe.category === 'meat').length, veg: set.filter(d => d.recipe.category === 'veg').length, soup: set.filter(d => d.recipe.category === 'soup').length });
  const accept = (set: Dish[]) => {
    if (!set.length || !checkSet(set, meal, context).valid) return;
    if ((req.action === 'replace') && set.length !== effectiveTarget) return;
    if (req.action === 'reroll' && set.map(d => d.recipe.id).sort().join(',') === previousSet) return;
    const c = counts(set);
    const distance = meal.composition === 'auto' ? Math.abs(c.meat - guide.counts.meat) + Math.abs(c.veg - guide.counts.veg) + Math.abs(c.soup - guide.counts.soup) : 0;
    const buyItems = checkSet(set, meal, context).checks.filter(c => c.state === 'missing' || c.state === 'shortage').length;
    const mainKinds = new Set(set.flatMap(d => d.reused)).size;
    const primaryScore = automatic
      ? Math.min(set.length, target) * 1_000_000 - Math.max(0, set.length - target) * 4000 - distance * 3000 + mainKinds * 3000 + set.filter(d => d.recipe.homeStyle).length * 100 - buyItems
      : set.length * 1_000_000 - distance * 10_000 + set.filter(d => d.recipe.homeStyle).length * 100 - buyItems;
    // Diversity breaks equally good plans only; it cannot override ingredient
    // reuse, category balance, home-style preference or fewer shopping items.
    const score = primaryScore + rank(set.map(d=>d.recipe.id).sort());
    if (score > bestScore) { best = [...set]; bestScore = score; }
  };
  // Seed a complete plan early, so larger requests do not depend on DFS ordering.
  const desired = meal.composition === 'custom' ? meal.counts : guide.counts;
  const seed = [...locked];
  const seedOrder = [...remaining].sort((a, b) => Number(b.reused.length > 0) - Number(a.reused.length > 0) || businessOrder(a, b));
  for (const d of seedOrder) {
    if (seed.length >= effectiveTarget) break;
    if (seed.some(x => x.recipe.id === d.recipe.id)) continue;
    if (counts(seed)[d.recipe.category] >= desired[d.recipe.category]) continue;
    const next = [...seed, d];
    if (checkSet(next, meal, context).valid) seed.push(d);
  }
  accept(seed);
  let phaseLimit = automatic ? effectiveTarget : searchLimit, expanding = false;
  const visit = async (set: Dish[], from: number): Promise<void> => {
    if (++nodes > maxNodes || performance.now() > deadline) { incomplete = true; return; }
    if (options.signal?.aborted) return;
    if (nodes % 128 === 0) await setImmediate();
    if (!expanding || set.length > target) accept(set);
    if (set.length >= phaseLimit) return;
    const remainingParents = remaining.slice(from).filter(d => !set.some(x => x.recipe.id === d.recipe.id));
    const currentCounts = counts(set);
    const possibleParents = meal.composition === 'custom'
      ? (['meat', 'veg', 'soup'] as const).reduce((sum, k) => sum + Math.min(Math.max(0, meal.counts[k] - currentCounts[k]), new Set(remainingParents.filter(d => d.recipe.category === k).map(d => d.recipe.id)).size), 0)
      : new Set(remainingParents.map(d => d.recipe.id)).size;
    if (!automatic && Math.min(searchLimit, set.length + possibleParents) < best.length) return;
    if (expanding) {
      const existingKinds = new Set(set.flatMap(d => d.reused));
      const byParent = new Map<string, number>();
      for (const d of remainingParents) byParent.set(d.recipe.id, Math.max(byParent.get(d.recipe.id) ?? 0, new Set(d.reused.filter(id => !existingKinds.has(id))).size));
      const gains = [...byParent.values()].sort((a, b) => b - a);
      const allKinds = new Set([...existingKinds, ...remainingParents.flatMap(d => d.reused)]).size;
      let upperScore = -Infinity;
      for (let n = Math.max(target + 1, set.length + 1); n <= Math.min(MAX_DISHES, set.length + gains.length); n++) {
        const maxKinds = Math.min(allKinds, existingKinds.size + gains.slice(0, n - set.length).reduce((a, b) => a + b, 0));
        // Category distance is at least abs(total - reference total).
        upperScore = Math.max(upperScore, target * 1_000_000 - (n - target) * 7000 + maxKinds * 3000 + n * 100);
      }
      if (upperScore + 1 <= bestScore) return;
    }
    for (let i = from; i < remaining.length; i++) {
      if (incomplete || options.signal?.aborted) break;
      const d = remaining[i];
      if (set.some(x => x.recipe.id === d.recipe.id)) continue;
      const next = [...set, d];
      const c = counts(next);
      if (meal.composition === 'custom' && (['meat', 'veg', 'soup'] as const).some(k => c[k] > meal.counts[k])) continue;
      // Cumulative exact shortages and explicitly labelled nominal-amount estimates;
      // blank amounts, incompatible units and mismatched forms never imply shortage.
      const checks = checkSet(next, meal, context).checks;
      if (!meal.allowBuy && (checks.some(c => c.state === 'shortage' || c.state === 'missing') || estimatedShortages(checks, meal).length)) continue;
      await visit(next, i + 1);
    }
  };
  await visit(locked, 0);
  if (automatic && !incomplete && !options.signal?.aborted) { phaseLimit = MAX_DISHES; expanding = true; await visit(locked, 0); }
  if (options.signal?.aborted) return result({ status: 'cancelled', search: 'incomplete', reasons: ['操作已取消'] });
  options.beforePublish?.();
  if (best.some(d => !checkDish(d.recipe, d.variant, meal, context).dish) || (best.length && !checkSet(best, meal, context).valid)) return result({ status: 'unavailable', reasons: ['内容在最终检查前变化，请重新生成'] });
  const replacingFailed = !best.length && (req.action === 'replace' || req.action === 'reroll');
  const replacement = req.action === 'replace' ? best.find(d => !req.selected.some(s => s.recipeId === d.recipe.id)) : undefined;
  const orderedBest = req.action === 'replace'
    ? req.selected.flatMap(s => {
      const dish = s.recipeId === req.replaceId ? replacement : best.find(d => d.recipe.id === s.recipeId);
      return dish ? [dish] : [];
    })
    : [...best].sort(variedOrder);
  return result({ dishes: orderedBest, checks: best.length ? checkSet(best, meal, context).checks : [], total: grouped.length,
    status: best.length ? 'completed' : incomplete ? 'unavailable' : 'no_results', search: incomplete ? 'incomplete' : 'complete', target: effectiveTarget,
    targetMet: automatic ? best.length >= effectiveTarget : best.length === effectiveTarget, changed: !replacingFailed,
    reasons: [
      ...(incomplete ? [best.length ? '还可以再试一次，看看其他搭配。' : '这次查找未完成，请再试一次。'] : []),
      ...(!best.length ? [replacingFailed ? '暂时没有其他合适的方案，已保留当前搭配。' : '暂时没有找到合适的搭配，可以调整食材、口味或搭配数量后再试。'] : []),
      ...(meal.composition === 'custom' && best.length < effectiveTarget && !incomplete ? [meal.allowBuy
        ? `你指定了 ${effectiveTarget} 道，目前可搭配 ${best.length} 道。可以减少菜数或调整口味后再试。`
        : `你指定了 ${effectiveTarget} 道，目前可搭配 ${best.length} 道。可以允许补买，或调整荤素汤数量。`] : []),
      ...(meal.composition === 'custom' && best.length < effectiveTarget && incomplete ? [`你指定了 ${effectiveTarget} 道，本次已核验 ${best.length} 道；搜索尚未完成，可以重新查找`] : []),
    ],
  });
}
