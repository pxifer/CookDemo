import { findFood } from '../shared/catalog';
import { parseQuantity } from '../shared/quantity';
import { inputMode, servingReference } from '../shared/meal-planning';
import type { Ingredient, Meal } from '../shared/types';

export const seasoningIds = ['oil', 'salt', 'soy', 'garlic', 'chilli', 'vinegar', 'sugar'];
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
export function inputIngredient(name: string): Ingredient {
  const food = findFood(name);
  return { id: crypto.randomUUID(), foodId: food?.id ?? null, name, amount: '', basis: 'unknown', form: food?.form ?? 'raw', status: food ? 'confirmed' : 'pending', original: name };
}
export function mergeInput(existing: Ingredient[], incoming: Ingredient[]): Ingredient[] {
  const next = existing.map(i => ({ ...i }));
  for (const item of incoming) {
    if (item.foodId && seasoningIds.includes(item.foodId)) continue;
    const old = next.find(i => item.foodId ? i.foodId === item.foodId : i.name === item.name);
    if (!old) { next.push({ ...item, status: item.foodId ? 'confirmed' : 'pending' }); continue; }
    if ((!item.amount || item.amount === old.amount) && old.form === item.form) continue;
    if (!old.amount && old.status !== 'conflict' && old.form === item.form) { old.amount = item.amount; continue; }
    const a = parseQuantity(old.amount), b = parseQuantity(item.amount);
    if (a && b && a.amount === b.amount && a.unit === b.unit && old.form === item.form) continue;
    old.alternative = item.amount; old.status = 'conflict';
  }
  return next;
}
export function normalizeInput(meal: Meal): Meal {
  return { ...meal, mode: inputMode(meal), counts: meal.composition === 'auto' ? { ...servingReference(meal.servings).counts } : meal.counts, ingredients: meal.ingredients.filter(i => !i.foodId || !seasoningIds.includes(i.foodId)).map(i => i.foodId && i.status === 'pending' ? { ...i, status: 'confirmed' } : i) };
}
