import { validateMeal } from './meal-validator.js';
import { defaultMeal, type Favorite, type Meal } from '../shared/types';
export const STORAGE_KEY = 'shiwei:guest:meal:v1';
export const GALLERY_FAVORITES_KEY='shiwei:guest:gallery-favorites:v1';
export const galleryFavoriteKey=(name:string,flavor:string)=>JSON.stringify([name,flavor]);
let owner: string | null = null;
export const setStorageOwner=(userId:string|null)=>{owner=userId;};
export const storageKey=(key:string)=>owner?key.replace('shiwei:guest:',`shiwei:user:${owner}:`):key;
export const readValue=(key:string):unknown=>{try{return JSON.parse(localStorage.getItem(storageKey(key))??'null');}catch{return null;}};
export function readMeal(key = STORAGE_KEY): Meal {
  try {
    const value: unknown = readValue(key);
    return validateMeal(value) ? value : defaultMeal();
  } catch { return defaultMeal(); }
}
export function writeValue(key: string, value: unknown): boolean {
  try { localStorage.setItem(storageKey(key), JSON.stringify(value)); window.dispatchEvent(new CustomEvent('shiwei:local-data',{detail:key})); return true; } catch { return false; }
}
export function writeMeal(meal: Meal): boolean {
  // Invalid editor values must not replace the last recoverable, schema-valid draft.
  return !validateMeal(meal) || writeValue(STORAGE_KEY, meal);
}
export function readFavorites(): Favorite[] {
  try {
    const value: unknown = readValue('shiwei:guest:favorites:v1')??[];
    return Array.isArray(value) ? value.filter(v => v && typeof v.recipeId === 'string' && typeof v.variantId === 'string').slice(0, 100) : [];
  } catch { return []; }
}
export function readGalleryFavorites():string[]{
  try{const value:unknown=readValue(GALLERY_FAVORITES_KEY)??[];return Array.isArray(value)?value.filter((v):v is string=>typeof v==='string').slice(0,100):[]}catch{return [];}
}
export function writeGalleryFavorites(value:string[]):boolean{return writeValue(GALLERY_FAVORITES_KEY,value);}
