import type { Dish, Food, Line, Meal } from '../shared/types';
import { findPantryIngredient } from '../shared/ingredient-matching';
import { isCookingWater } from '../shared/pantry';
import { ingredientDisplayText } from '../shared/recipe-copy';

/** Show the original recipe quantity, never invent a dose or a stock deficit. */
export function recipeLineText(line: Line, lookup: ReadonlyMap<string, Food>) {
  const name = lookup.get(line.foodId)?.name ?? '';
  const source = line.sourceText?ingredientDisplayText(line.sourceText):undefined;
  return source || `${name}${line.amount === null ? '' : ` ${line.amount}${line.unit}`}`;
}

export function shoppingList(dishes: Dish[], meal: Meal, lookup: ReadonlyMap<string, Food>): string[] {
  if (!meal.allowBuy) return [];
  return [...new Set(dishes.flatMap(dish => dish.variant.lines.filter(line => {
    if (line.optional || isCookingWater(lookup.get(line.foodId)!.name)) return false;
    if (line.role === 'seasoning' && !meal.checkSeasonings) return false;
    // Having an ingredient does not prove a quantity is sufficient. The engine
    // retains that distinction; the shopping display follows the user's choice
    // to show recipe amounts only for ingredients they have not selected.
    if (findPantryIngredient(line, meal.ingredients, lookup)) return false;
    return dish.checks.some(check => check.foodId === line.foodId && check.state === 'missing');
  }).map(line => recipeLineText(line,lookup))))];
}
