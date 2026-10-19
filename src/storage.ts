import { validateMeal } from './meal-validator.js';
import { defaultMeal, type Favorite, type Meal } from '../shared/types';
export const STORAGE_KEY = 'shiwei:guest:meal:v1';
export function readMeal(key = STORAGE_KEY): Meal {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return validateMeal(value) ? value : defaultMeal();
  } catch { return defaultMeal(); }
}
export function writeValue(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function writeMeal(meal: Meal): boolean {
  // Invalid editor values must not replace the last recoverable, schema-valid draft.
  return !validateMeal(meal) || writeValue(STORAGE_KEY, meal);
}
export function readFavorites(): Favorite[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('shiwei:guest:favorites:v1') ?? '[]');
    return Array.isArray(value) ? value.filter(v => v && typeof v.recipeId === 'string' && typeof v.variantId === 'string').slice(0, 100) : [];
  } catch { return []; }
}
