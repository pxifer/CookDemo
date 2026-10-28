import type { Favorite, Meal } from './types';
import { defaultMeal } from './types';
export interface AccountValue { favorites: Favorite[]; defaults: Meal | null }
export interface AccountSnapshot { version: number; value: AccountValue;healthKey?:{configured:boolean;last4?:string} }
export const emptyAccount = (): AccountValue => ({favorites:[],defaults:null});

// Keep the legacy envelope field for existing accounts. Only the explicit fields below
// describe personal settings; diner count and meal drafts never travel with them.
export type PersonalSettings = Pick<Meal,'flavor'|'restrictions'|'checkSeasonings'|'seasonings'|'aiExcludedFoods'|'healthProfile'|'aiFoodPreferences'>;
export function settingsFields(meal:PersonalSettings):PersonalSettings {
  return {flavor:meal.flavor,restrictions:meal.restrictions.filter(r=>r.scope==='self'),checkSeasonings:meal.checkSeasonings,seasonings:[...meal.seasonings],...(meal.aiExcludedFoods?{aiExcludedFoods:[...meal.aiExcludedFoods]}:{}),...(meal.aiFoodPreferences?{aiFoodPreferences:structuredClone(meal.aiFoodPreferences)}:{}),...(meal.healthProfile?{healthProfile:structuredClone(meal.healthProfile)}:{})};
}
export function personalSettings(meal:PersonalSettings):Meal {
  return {...defaultMeal(),flavor:meal.flavor,restrictions:meal.restrictions.filter(r=>r.scope==='self'),checkSeasonings:meal.checkSeasonings,seasonings:[...meal.seasonings],...(meal.aiExcludedFoods?{aiExcludedFoods:[...meal.aiExcludedFoods]}:{}),...(meal.aiFoodPreferences?{aiFoodPreferences:structuredClone(meal.aiFoodPreferences)}:{}),...(meal.healthProfile?{healthProfile:structuredClone(meal.healthProfile)}:{})};
}
export function applyPersonalSettings(meal:Meal,settings:PersonalSettings|null):Meal {
  const changed=Boolean(settings)&&(JSON.stringify(meal.healthProfile?.topics)!==JSON.stringify(settings?.healthProfile?.topics)||JSON.stringify(meal.aiFoodPreferences)!==JSON.stringify(settings?.aiFoodPreferences)||Boolean(meal.healthProfile&&!settings?.healthProfile));
  return settings?{...meal,flavor:settings.flavor,checkSeasonings:settings.checkSeasonings,seasonings:[...settings.seasonings],...(changed?{aiFoodChoices:undefined,diseases:settings.healthProfile?.conditions??[]}:{}),aiExcludedFoods:settings.aiExcludedFoods?[...settings.aiExcludedFoods]:undefined,aiFoodPreferences:settings.aiFoodPreferences?structuredClone(settings.aiFoodPreferences):undefined,healthProfile:settings.healthProfile?structuredClone(settings.healthProfile):undefined,restrictions:[...settings.restrictions.filter(r=>r.scope==='self'),...meal.restrictions.filter(r=>r.scope==='additional')]}:meal;
}
