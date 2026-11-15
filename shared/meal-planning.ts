import type { Category, Meal } from './types';

export const MAX_DISHES = 20;
export type DishCounts = Record<Category, number>;
export const emptyCounts = (): DishCounts => ({ meat: 0, veg: 0, soup: 0 });
export const totalCounts = (counts: DishCounts) => counts.meat + counts.veg + counts.soup;
// Display order is fixed so result wording and tests stay stable.
export const categories: Category[] = ['meat', 'veg', 'soup'];
export const compositionError = (meal: Pick<Meal, 'composition' | 'counts'>) => {
  if (meal.composition !== 'custom') return '';
  const values = Object.values(meal.counts);
  return values.some(n => !Number.isInteger(n) || n < 0 || n > MAX_DISHES) || values.reduce((a, b) => a + b, 0) < 1 || values.reduce((a, b) => a + b, 0) > MAX_DISHES
    ? '请选择荤、素、汤的道数，不需要的类别选 0，合计 1～20 道' : '';
};
// A meal either browses by ingredient match with no count target ('candidates'),
// or assembles an exact 荤/素/汤 plan ('meal'). Buying permission never changes this.
export const inputMode = (meal: Pick<Meal, 'composition'>): Meal['mode'] => meal.composition === 'custom' ? 'meal' : 'candidates';
export const dishCounts = (dishes: readonly { recipe: { category: Category } }[]): DishCounts => {
  const counts = emptyCounts();
  for (const dish of dishes) counts[dish.recipe.category]++;
  return counts;
};
export const countShortfall = (picked: DishCounts, desired: DishCounts): DishCounts => ({
  meat: Math.max(0, desired.meat - picked.meat),
  veg: Math.max(0, desired.veg - picked.veg),
  soup: Math.max(0, desired.soup - picked.soup),
});
