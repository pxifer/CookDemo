export type Category = 'meat' | 'veg' | 'soup';
export type Basis = 'edible' | 'as_purchased' | 'unknown';
export interface Food {
  id: string; name: string; aliases: string[]; unit: 'g' | '个' | 'ml';
  form: string; allergens: string[]; componentsComplete: boolean;
  nutrition: Partial<Record<'kcal' | 'protein' | 'sodium', number>>;
  nutritionSources?: Partial<Record<'kcal' | 'protein' | 'sodium', { sourceId: string; sourceVersion: string; recordId: string; unit: string; basisGrams: 100 }>>;
}
export interface Ingredient {
  id: string; foodId: string | null; name: string; amount: string; quantityUnit?: string;
  basis: Basis; form: string; status: 'pending' | 'confirmed' | 'conflict';
  alternative?: string; original: string;
}
export interface Restriction {
  id: string; kind: 'allergy' | 'avoid' | 'unclassified'; name: string;
  targets: string[]; status: 'pending' | 'confirmed' | 'unknown' | 'conflict';
  scope: 'self' | 'additional'; original: string;
}
export interface Extraction {
  original: string; ingredients: Ingredient[]; restrictions: Restriction[];
  diseases: string[]; servings: number | null; unresolved: string[];
  method: 'local-dictionary';
}
export interface Line {
  foodId: string; amount: number | null; unit: 'g' | '个' | 'ml';
  role: 'main' | 'auxiliary' | 'seasoning'; basis: Basis; form: string;
  optional?: boolean; edibleGrams?: number; sourceText?: string;
}
export interface Variant {
  id: string; flavor: string; lines: Line[]; steps: string[];
  methodLabel?: string;
  methodOptions?: { label: string; steps: string[] }[];
  ingredientNotes?: string[]; reviewNotes?: string[];
}
export interface Recipe {
  id: string; name: string; category: Category; homeStyle: boolean;
  minutes: number | null; servings: number; image: 'meat' | 'veg' | 'meal';
  imageUrl?: string;
  version: string; state: 'published' | 'withdrawn'; variants: Variant[];
  publicAttribution?: { label: string; url: string };
  source: { kind: 'constructed' | 'community' | 'local-candidate'; author: string; license: string; reviewed: boolean;
    uri?: string; reviewBasis?: 'source-and-structure'; commit?: string; recordId?: string };
}
export interface Meal {
  version: number; raw: string; ingredients: Ingredient[]; restrictions: Restriction[];
  // Diners guide dish count only; recipe batch quantities never scale with this value.
  servings: number; mode: 'meal' | 'candidates'; health: boolean; diseases: string[];
  flavor: string; overrides: Record<string, string>; includeAdditional: boolean;
  checkSeasonings: boolean; seasonings: string[]; allowBuy: boolean;
  composition: 'auto' | 'custom'; counts: Record<Category, number>;
}
export interface QuantityCheck {
  foodId: string; name: string; state: 'enough' | 'shortage' | 'unverified' | 'missing';
  needed: number | null; available: number | null; shortage: number | null; unit: string;
  reason: string; basis: Basis;
}
export interface Dish {
  recipe: Recipe; variant: Variant; checks: QuantityCheck[];
  nutrition: Record<'kcal' | 'protein' | 'sodium', number | null>;
  reused: string[]; omitted: string[];
}
export interface RecommendationRequest {
  contentVersion?: string;
  operationId: string; meal: Meal; action: 'generate' | 'reroll' | 'replace' | 'page' | 'variant';
  selected: { recipeId: string; variantId: string }[]; replaceId?: string;
  page: number; cursor?: string; previous: string[];
}
export interface RecommendationResult {
  healthAssessment?: { state: 'test_only'; message: string };
  operationId: string; mealVersion: number; contentVersion: string;
  status: 'completed' | 'needs_confirmation' | 'no_results' | 'unavailable' | 'cancelled';
  search: 'complete' | 'incomplete'; target: number; targetMet: boolean;
  dishes: Dish[]; checks: QuantityCheck[]; reasons: string[];
  total: number; page: number; cursor: string; nodes: number; changed: boolean;
  elapsedMs: number;
}
export interface Favorite { recipeId: string; variantId: string }
export const CONTENT_VERSION = 'constructed-2026-10-19-v1';
export const defaultMeal = (): Meal => ({
  version: 0, raw: '', ingredients: [], restrictions: [], servings: 1,
  mode: 'meal', health: false, diseases: [], flavor: '不限', overrides: {},
  includeAdditional: false, checkSeasonings: false, seasonings: ['oil', 'salt', 'soy', 'garlic'],
  allowBuy: false, composition: 'auto', counts: { meat: 1, veg: 2, soup: 0 },
});
