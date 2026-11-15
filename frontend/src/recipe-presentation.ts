import type { Dish, Food, Line, Meal } from '../../shared/types';
import { findPantryIngredient } from '../../shared/ingredient-matching';
import { isCookingWater } from '../../shared/pantry';
import { ingredientDisplayText } from '../../shared/recipe-copy';

/** Show the original recipe quantity, never invent a dose or a stock deficit. */
export function recipeLineText(line: Line, lookup: ReadonlyMap<string, Food>) {
  const name = lookup.get(line.foodId)?.name ?? '';
  const source = line.sourceText?ingredientDisplayText(line.sourceText):undefined;
  return source || `${name}${line.amount === null ? '' : ` ${line.amount}${line.unit}`}`;
}

const unitAliases: Record<string, string> = { 克: 'g', 千克: 'kg', 公斤: 'kg', 毫升: 'ml', 升: 'l' };
const unitPattern = /^(\d+(?:\.\d+)?)\s*(千克|公斤|kg|克|g|毫升|ml|升|l|斤|个|只|条|根|块|片|颗|把|勺|茶匙|汤匙|杯|瓣)/i;

/** Parse the visible quantity and unit from an original recipe line.
 * Ranges ("3-4 个") and free text stay unmerged: summing them would invent a dose. */
function shoppingQuantity(line: Line, name: string): { amount: number; unit: string; label: string } | null {
  if (line.amount !== null) return { amount: line.amount, unit: line.unit, label: line.unit };
  const text = (line.sourceText ?? '').replace(name, '').replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
  const match = text.match(unitPattern);
  if (!match) return null;
  return { amount: Number(match[1]), unit: unitAliases[match[2].toLowerCase()] ?? match[2], label: match[2] };
}

const formatAmount = (value: number) => String(Math.round(value * 1000) / 1000);
const UNKNOWN_NOTE = '（另有用量未注明）';

export function shoppingList(dishes: Dish[], meal: Meal, lookup: ReadonlyMap<string, Food>): string[] {
  if (!meal.allowBuy) return [];
  type Item = { foodId: string; name: string; parsed: { amount: number; unit: string; label: string } | null; text: string };
  const items: Item[] = [];
  for (const dish of dishes) for (const line of dish.variant.lines) {
    if (line.optional || isCookingWater(lookup.get(line.foodId)!.name)) continue;
    if (line.role === 'seasoning' && !meal.checkSeasonings) continue;
    // Having an ingredient does not prove a quantity is sufficient. The engine
    // retains that distinction; the shopping display follows the user's choice
    // to show recipe amounts only for ingredients they have not selected.
    if (findPantryIngredient(line, meal.ingredients, lookup)) continue;
    if (!dish.checks.some(check => check.foodId === line.foodId && check.state === 'missing')) continue;
    const name = lookup.get(line.foodId)?.name ?? '';
    items.push({ foodId: line.foodId, name: name || line.foodId, parsed: shoppingQuantity(line, name), text: recipeLineText(line, lookup) });
  }
  // Only the same food and the same unit are summed; different units stay separate.
  const known = new Map<string, { foodId: string; name: string; unitLabel: string; amount: number }>();
  const unknownFoods = new Set<string>(), knownFoods = new Set<string>();
  for (const item of items) {
    if (!item.parsed) { unknownFoods.add(item.foodId); continue; }
    knownFoods.add(item.foodId);
    const key = `${item.foodId}|${item.parsed.unit}`;
    const row = known.get(key);
    if (row) row.amount += item.parsed.amount;
    else known.set(key, { foodId: item.foodId, name: item.name, unitLabel: item.parsed.label, amount: item.parsed.amount });
  }
  const emitted = new Set<string>(), emittedUnknown = new Set<string>(), noted = new Set<string>(), out: string[] = [];
  for (const item of items) {
    if (!item.parsed) {
      // A food with a known amount already carries the "unknown amount" note;
      // do not show a second bare line for it.
      if (knownFoods.has(item.foodId) || emittedUnknown.has(item.foodId)) continue;
      if (out.includes(item.text)) continue;
      emittedUnknown.add(item.foodId); out.push(item.text); continue;
    }
    const key = `${item.foodId}|${item.parsed.unit}`;
    if (emitted.has(key)) continue;
    emitted.add(key);
    const row = known.get(key)!;
    const note = unknownFoods.has(item.foodId) && !noted.has(item.foodId) ? UNKNOWN_NOTE : '';
    if (note) noted.add(item.foodId);
    out.push(`${row.name} ${formatAmount(row.amount)}${row.unitLabel}${note}`);
  }
  return out;
}
