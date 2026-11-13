import { parseQuantity } from './quantity';
import type { Category, Meal, QuantityCheck } from './types';

export const MAX_DISHES = 20;
export type DishCounts = Record<Category, number>;
// Product serving references, not nutritional or clinical recommendations.
export const servingReferences = [
  [1, 2, 0], [2, 3, 0], [2, 3, 0], [3, 3, 1],
  [3, 4, 1], [4, 4, 1], [4, 5, 1], [5, 5, 1],
  [5, 6, 1], [6, 6, 1], [6, 7, 1], [7, 7, 1],
].map(([meat, veg, soup], index) => ({ servings: index + 1, counts: { meat, veg, soup }, total: meat + veg + soup }));
export const servingReference = (servings: number) => servingReferences.find(r => r.servings === servings) ?? servingReferences[0];
export const compositionError = (meal: Pick<Meal, 'composition' | 'counts'>) => {
  if (meal.composition !== 'custom') return '';
  const values = Object.values(meal.counts);
  return values.some(n => !Number.isInteger(n) || n < 0 || n > MAX_DISHES) || values.reduce((a, b) => a + b, 0) < 1 || values.reduce((a, b) => a + b, 0) > MAX_DISHES
    ? '请填写荤、素、汤的整数数量，不需要的填 0，合计 1～20 道' : '';
};
export const inputMode = (meal: Pick<Meal, 'allowBuy' | 'composition'> & {health?:boolean}): Meal['mode'] => !meal.health && meal.allowBuy && meal.composition === 'auto' ? 'candidates' : 'meal';

// Legacy quantity diagnostic, retained for historical callers only.
// D19-13: recommendation paths must not use pantry amounts to plan or reject dishes.
export function estimatedShortages(checks: QuantityCheck[], meal: Meal) {
  return checks.filter(c => {
    if (c.state !== 'unverified' || c.basis !== 'edible' || !c.reason.includes('基准')) return false;
    const item = meal.ingredients.find(i => i.foodId === c.foodId && i.status === 'confirmed');
    const parsed = item && parseQuantity(item.amount);
    return c.needed !== null && item?.form === 'raw' && item.basis !== 'edible' && parsed && parsed.unit === c.unit && parsed.amount < c.needed;
  });
}
