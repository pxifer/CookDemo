import { constructedContent } from '../../shared/catalog';
import type { ContentContext } from '../../shared/content';
import { inputMode, servingReference } from '../../shared/meal-planning';
import type { Extraction, Ingredient, Meal } from '../../shared/types';
import { availableFlavors } from '../../shared/flavors';
import { isSeasoningFood, pantryGroups, seasoningStockKey } from '../../shared/pantry';
import { resolvePantryFood } from '../../shared/ingredient-matching';

export const seasoningIds = pantryGroups.flatMap(g => g.ids);
export const units = ['g', 'kg', '斤', '个', 'ml', 'l', '把', '根', '块'];
const aliases: Record<string, string> = { 克: 'g', 千克: 'kg', 公斤: 'kg', 毫升: 'ml', 升: 'l' };
export function amountParts(item: Pick<Ingredient, 'amount' | 'quantityUnit'>) {
  const match = item.amount.trim().match(/^(.*?)\s*(千克|公斤|毫升|kg|ml|克|斤|个|升|g|l|把|根|块)$/i);
  return match ? { value: match[1], unit: aliases[match[2]] ?? match[2].toLowerCase() } : { value: item.amount, unit: item.quantityUnit ?? 'g' };
}
export function setAmount(item: Ingredient, value: string, unit: string): Ingredient {
  const typed = amountParts({ amount: value });
  const explicit = value.trim() !== typed.value && units.includes(typed.unit);
  return { ...item, amount: value.trim() ? explicit ? `${typed.value}${typed.unit}` : `${value.trim()}${unit}` : '', quantityUnit: explicit ? typed.unit : unit };
}
export function inputIngredient(name: string, context: ContentContext = constructedContent): Ingredient {
  const food = resolvePantryFood(name, context.foodById);
  return { id: crypto.randomUUID(), foodId: food?.id ?? null, name, amount: '', basis: 'unknown', form: food?.form ?? 'raw', status: food ? 'confirmed' : 'pending', original: name };
}
/**
 * Keep unparsed input in the ingredient list as a pending item. It may resolve
 * against the current client vocabulary even when an older extraction service
 * returned it as unresolved; genuinely unknown text stays visible and inert.
 * Dietary restrictions are handled only through `Extraction.restrictions`.
 */
export function parsedIngredients(data: Pick<Extraction, 'ingredients' | 'unresolved'>, context: ContentContext = constructedContent): Ingredient[] {
  const parsed = data.ingredients.filter(i => !i.foodId || !seasoningIds.includes(i.foodId));
  const keys = new Set(parsed.map(i => i.foodId ? `food:${i.foodId}` : `name:${i.name.trim()}`));
  for (const text of data.unresolved) {
    const name = text.trim().slice(0, 100);
    if (!name) continue;
    const item = inputIngredient(name, context);
    if (item.foodId && seasoningIds.includes(item.foodId)) continue;
    const key = item.foodId ? `food:${item.foodId}` : `name:${item.name}`;
    if (keys.has(key)) continue;
    keys.add(key);
    parsed.push(item);
  }
  return parsed;
}
export function resolveExtraction(data: Extraction, context: ContentContext = constructedContent): Pick<Extraction, 'ingredients' | 'restrictions'> {
  return { ingredients: parsedIngredients(data, context), restrictions: data.restrictions };
}
export function mergeInput(existing: Ingredient[], incoming: Ingredient[]): Ingredient[] {
  const next:Ingredient[] = existing.map(i => {const value={...i,amount:"",original:i.name};delete value.quantityUnit;delete value.alternative;if(value.foodId&&value.status==='conflict'){value.status='confirmed';delete value.alternative;}return value;});
  for (const item of incoming) {
    if (item.foodId && seasoningIds.includes(item.foodId)) continue;
    const old = next.find(i => item.foodId ? i.foodId === item.foodId : i.name === item.name);
    if (!old) { next.push({ ...item,amount:"",quantityUnit:undefined,alternative:undefined,original:item.name,status:item.foodId?'confirmed':'pending' }); continue; }

  }
  return next;
}
export function contentSeasonings(context: ContentContext) {
  return [...new Set([...seasoningIds.filter(id => context.foodById.has(id)), ...context.recipes.flatMap(r => r.variants.flatMap(v => v.lines.filter(l => l.role === 'seasoning' && isSeasoningFood(context.foodById.get(l.foodId)!)).map(l => {const key=seasoningStockKey(context.foodById.get(l.foodId)!);return context.foodById.has(key)?key:l.foodId;})))])];
}
export function normalizeInput(meal: Meal, context: ContentContext = constructedContent): Meal {
  const seasonings = contentSeasonings(context);
  let ingredients = mergeInput([], meal.ingredients.map(item => {
    const known = item.foodId && context.foodById.get(item.foodId);
    const food = known || resolvePantryFood(item.name, context.foodById);
    return { ...item, foodId: food?.id ?? null, form: !known && food ? food.form : item.form,
      status: item.status === 'conflict' ? 'conflict' as const : food ? 'confirmed' as const : 'pending' as const };
  }).filter(item => !item.foodId || !seasonings.includes(item.foodId)));
  // Repair only the exact artifact created by the old unresolved->restriction
  // handler. Genuine unknown allergies, avoidances and conflicts stay intact.
  const restrictions = meal.restrictions.filter(restriction => {
    if (restriction.kind !== 'unclassified' || restriction.status === 'conflict' || restriction.scope !== 'self'
      || restriction.targets.length || restriction.original !== restriction.name || !restriction.name.startsWith('未分类：')) return true;
    const restored = inputIngredient(restriction.name.slice('未分类：'.length), context);
    if (!restored.foodId || ingredients.length >= 100 && !ingredients.some(item => item.foodId === restored.foodId)) return true;
    ingredients = mergeInput(ingredients, [restored]);
    return false;
  });
  return { ...meal, mode: inputMode(meal), counts: meal.composition === 'auto' ? { ...servingReference(meal.servings).counts } : meal.counts,
    flavor: meal.flavor === '不限' || availableFlavors(context.recipes).includes(meal.flavor) ? meal.flavor : '不限',
    overrides: Object.fromEntries(Object.entries(meal.overrides).filter(([id, variant]) => context.recipes.some(r => r.id === id && r.variants.some(v => v.id === variant)))),
    ingredients, seasonings: [...new Set(meal.seasonings.map(id=>{const food=context.foodById.get(id);return food?seasoningStockKey(food):id;}))],
    restrictions: restrictions.map(r => {
      const expected = context.restrictionTargets(r.name);
      return r.status === 'confirmed' && JSON.stringify([...expected].sort()) !== JSON.stringify([...r.targets].sort())
        ? { ...r, targets: expected, status: expected.length ? 'pending' : 'unknown' } : r;
    }) };
}
