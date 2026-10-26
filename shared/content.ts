import type { Food, Recipe } from './types';
import { ingredientFamilyFoods, isPantryQueryId } from './ingredient-matching';

export interface FoodCategory { name: string; aliases: string[]; targets: string[]; note: string }
export interface CompositionApproval { reviewId: string; recipeId: string; variantId: string; fingerprint: string }
export interface ContentSnapshot {
  restrictionScope?: 'listed-foods';
  contentVersion: string; contentState?: 'constructed' | 'database-constructed' | 'database-reviewed' | 'database-candidate';
  sourceEvidence?: Record<'recipe' | 'food' | 'nutrition', { title: string; uri: string; license: string; evidence: string; checkedAt: string }>;
  foods: Food[]; recipes: Recipe[]; categories: FoodCategory[];
  relations?: { foodId: string; relatedFoodId: string; kind: 'contains' }[];
  compositionApprovals?: CompositionApproval[];
  unresolvedComponents?:string[];
  /** Product components whose uncertainty is limited to specific restriction targets. */
  uncertainComponents?:{foodId:string;targetIds:string[];evidence:string}[];
  verifiedIngredientIdentities?:{foodId:string;identityId?:string;allergens:string[];evidence:string}[];
}
export interface ContentContext extends ContentSnapshot {
  foodById: ReadonlyMap<string, Food>;
  findFood(name: string): Food | undefined;
  restrictionTargets(name: string): string[];
  components(id: string): Food[];
}
export function contentContext(snapshot: ContentSnapshot): ContentContext {
  // Broad pantry input terms belong to the runtime recognition layer, not to
  // reviewed food releases. Enrich every context so browser and server parsing
  // agree even when the selected recipe catalog is loaded from an older release.
  const runtimeSnapshot = { ...snapshot, foods: [...snapshot.foods, ...ingredientFamilyFoods(snapshot.foods)] };
  const index = new Map(runtimeSnapshot.foods.map(f => [f.id, f]));
  const related = new Map<string, string[]>();
  for (const relation of snapshot.relations ?? []) related.set(relation.foodId, [...(related.get(relation.foodId) ?? []), relation.relatedFoodId]);
  const componentCache = new Map<string, Food[]>();
  const findFood = (name: string) => {
    if(snapshot.restrictionScope==='listed-foods'){
      const exact=runtimeSnapshot.foods.filter(food=>food.name===name);
      if(exact.length===1)return exact[0];
    }
    const matches = runtimeSnapshot.foods.filter(f => f.name === name || f.aliases.includes(name));
    return matches.length === 1 ? matches[0] : undefined;
  };
  const components = (id: string, visited = new Set<string>()): Food[] => {
    const rootCall = visited.size === 0;
    if (rootCall && componentCache.has(id)) return componentCache.get(id)!;
    if (visited.has(id)) throw new Error('CONTENT_RELATION_CYCLE');
    const food = index.get(id); if (!food) throw new Error('CONTENT_FOOD_MISSING');
    const next = new Set(visited).add(id);
    const result = [food, ...(related.get(id) ?? []).flatMap(relatedId => components(relatedId, next))];
    if (rootCall) componentCache.set(id, result);
    return result;
  };
  return { ...runtimeSnapshot, foodById: index, findFood, components,
    restrictionTargets: name => {
      const food = findFood(name);
      if (food) return isPantryQueryId(food.id) ? [] : [food.id];
      return [...(snapshot.categories.find(c => c.name === name || c.aliases.includes(name))?.targets ?? [])];
    } };
}
