import type { Favorite, Meal } from './types';
import { defaultMeal } from './types';
export interface AccountValue { favorites: Favorite[]; defaults: Meal | null }
export interface AccountSnapshot { version: number; value: AccountValue }
export const emptyAccount = (): AccountValue => ({favorites:[],defaults:null});

// Keep the legacy envelope field for existing accounts. Only the explicit fields below
// describe personal settings; diner count and meal drafts never travel with them.
export type PersonalSettings = Pick<Meal,'flavor'|'restrictions'|'checkSeasonings'|'seasonings'|'aiExcludedFoods'>;
export function settingsFields(meal:PersonalSettings):PersonalSettings {
  return {flavor:meal.flavor,restrictions:meal.restrictions.filter(r=>r.scope==='self'),checkSeasonings:meal.checkSeasonings,seasonings:[...meal.seasonings],...(meal.aiExcludedFoods?{aiExcludedFoods:[...meal.aiExcludedFoods]}:{})};
}
export function personalSettings(meal:PersonalSettings):Meal {
  return {...defaultMeal(),flavor:meal.flavor,restrictions:meal.restrictions.filter(r=>r.scope==='self'),checkSeasonings:meal.checkSeasonings,seasonings:[...meal.seasonings],...(meal.aiExcludedFoods?{aiExcludedFoods:[...meal.aiExcludedFoods]}:{})};
}
export function applyPersonalSettings(meal:Meal,settings:PersonalSettings|null):Meal {
  return settings?{...meal,flavor:settings.flavor,checkSeasonings:settings.checkSeasonings,seasonings:[...settings.seasonings],aiExcludedFoods:settings.aiExcludedFoods?[...settings.aiExcludedFoods]:undefined,restrictions:[...settings.restrictions.filter(r=>r.scope==='self'),...meal.restrictions.filter(r=>r.scope==='additional')]}:meal;
}
