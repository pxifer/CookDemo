import type { Food, Ingredient, Line } from './types';

export type IngredientMatch = { ingredient: Ingredient; kind: 'exact' | 'broad' };

/**
 * Explicitly recognized broad pantry categories. A family match only helps find a
 * recipe; it never proves that a cut, variety, processing form, or quantity fits.
 * Keep these patterns narrow so unrelated staples (for example rice noodles) do
 * not become interchangeable with vermicelli.
 */
const families: { id: string; name: string; inputs: string[]; recipeNames: RegExp; excludedRecipeNames?: RegExp }[] = [
  { id: 'pork', name: '猪肉', inputs: ['猪肉', '瘦肉'], recipeNames: /(?:猪肉|瘦肉|五花肉|里脊肉?|梅花肉|梅头猪肉|二刀肉|排骨|肋排|猪排|猪蹄|猪肘|猪前肘|肘子|肉馅|肉末)/,
    excludedRecipeNames: /牛|羊|鸡|鸭|鹅|鱼|虾/ },
  { id: 'chicken', name: '鸡肉', inputs: ['鸡肉', '鸡'], recipeNames: /(?:鸡肉|鸡腿|鸡翅|鸡爪|鸡肝|鸡胸|鸡全翅|手枪腿|^鸡$)/,
    excludedRecipeNames: /鸡蛋|鸡精|鸡粉|鸡汤|鸡油/ },
  { id: 'beef', name: '牛肉', inputs: ['牛肉'], recipeNames: /(?:牛肉|牛腩|肥牛|牛里脊|牛排|牛筋|牛腱)/,
    excludedRecipeNames: /牛奶|牛油|牛肉高汤/ },
  { id: 'lamb', name: '羊肉', inputs: ['羊肉'], recipeNames: /(?:羊肉|羊腩|羊排|羊腿|羊蝎子|羊杂)/ },
  { id: 'fish', name: '鱼', inputs: ['鱼', '鲜鱼'], recipeNames: /(?:鱼|鳝丝?|鳗鱼|白鱔)/,
    excludedRecipeNames: /鱼露|鱼丸|鱼豆腐|鱼粉|鱼皮|鱼籽/ },
  { id: 'shrimp', name: '虾', inputs: ['虾', '大虾', '鲜虾'], recipeNames: /虾/,
    excludedRecipeNames: /虾皮|虾酱|虾粉|虾米/ },
  { id: 'vermicelli', name: '粉条', inputs: ['粉条', '粉丝'], recipeNames: /(?:粉条|粉丝|宽粉)/,
    excludedRecipeNames: /米粉|面粉|淀粉/ },
  { id: 'mushroom', name: '蘑菇', inputs: ['蘑菇', '菌菇'], recipeNames: /(?:菇|口蘑|白蘑)/ },
  { id: 'tofu', name: '豆腐', inputs: ['豆腐'], recipeNames: /^(?:白|老|嫩|南|北|内酯|水)?豆腐$/ },
  { id: 'cabbage', name: '白菜', inputs: ['白菜'], recipeNames: /(?:白菜|娃娃菜)/,
    excludedRecipeNames: /酸菜|腌|泡菜|圆白菜/ },
  { id: 'pepper', name: '青椒', inputs: ['青椒'], recipeNames: /(?:青椒|螺丝椒|尖椒|菜椒|青红椒)/,
    excludedRecipeNames: /干|泡|腌/ },
  { id: 'broccoli', name: '西兰花', inputs: ['西兰花', '西蓝花', '绿花菜'], recipeNames: /(?:西兰花|西蓝花|绿花菜)/ },
  { id: 'cauliflower', name: '花菜', inputs: ['花菜', '菜花'], recipeNames: /(?:花菜|菜花)/, excludedRecipeNames: /黄花菜/ },
];

export const normalizeIngredientName = (name: string) => name.normalize('NFKC').toLowerCase().replace(/\s+/g, '').trim();
const isQueryName = (name: string) => /^[\p{Script=Han}a-z]{2,24}$/u.test(name);
// Name containment describes a variety or preparation, not an arbitrary product
// made from it: potato is not potato starch, and peanut is not peanut oil.
const derivatives = ['淀粉', '面粉', '粉末', '酱', '汁', '油', '精', '高汤', '丸', '肉松', '香肠', '腊肠', '火腿', '罐头', '芽', '腌', '泡', '腊', '熏', '酸菜', '葫芦巴'];
const vermicelliNames = ['粉条', '粉丝', '宽粉'];
const productMismatch = (pantry: string, recipe: string) => derivatives.some(marker => recipe.includes(marker) && !pantry.includes(marker))
  || recipe.endsWith('粉') && !pantry.endsWith('粉')
  || vermicelliNames.some(name => recipe.includes(name)) && !vermicelliNames.some(name => pantry.includes(name));

function compatibleNames(pantryNames: string[], recipeNames: string[]): boolean {
  const pantry = pantryNames.map(normalizeIngredientName).filter(Boolean);
  const recipe = recipeNames.map(normalizeIngredientName).filter(Boolean);
  if (pantry.some(p => recipe.includes(p))) return true;
  const family = families.find(f => pantry.some(p => f.inputs.includes(p)));
  if (family) return recipe.some(r => family.recipeNames.test(r) && !family.excludedRecipeNames?.test(r)
    && pantry.some(p => !productMismatch(p, r)));
  return pantry.some(p => isQueryName(p) && recipe.some(r => r.includes(p) && !productMismatch(p, r)));
}

export const isPantryQueryId = (id: string) => id.startsWith('ingredient-family-') || id.startsWith('pantry-query-');
const inputFood = (id: string, name: string, aliases: string[] = []): Food => ({ id, name, aliases, unit: 'g', form: 'unspecified',
  allergens: [], componentsComplete: false, nutrition: {} });
function queryId(name: string): string {
  let hash = 2166136261;
  for (const character of name) hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  return `pantry-query-${(hash >>> 0).toString(16)}`;
}

// Only proven synonyms auto-resolve. Ambiguous visual labels require a user choice.
const inputSynonyms = [ ['小西红柿','小番茄','樱桃番茄','圣女果'], ['番茄','西红柿'], ['马铃薯','土豆'], ['洋白菜','卷心菜','包菜'], ['青花菜','西兰花'] ];
export function suggestPantryFoods(name:string,lookup:ReadonlyMap<string,Food>):Food[] {
  const term=normalizeIngredientName(name);
  const choices:Record<string,string[]>={生肉:['猪肉','牛肉','羊肉','鸡肉'],肉:['猪肉','牛肉','羊肉','鸡肉'],干果:['核桃','杏仁','腰果','葡萄干','红枣'],坚果:['核桃','杏仁','腰果'],小西红柿:['圣女果','小番茄','西红柿']};
  const preferred=choices[term]??inputSynonyms.find(group=>group.includes(term))??[];
  return [...new Map(preferred.filter(n=>n!==term).flatMap(n=>{const food=resolvePantryFood(n,lookup);return food?[food]:[];}).map(f=>[f.id,f])).values()].slice(0,5);
}

/** Shared input resolver. Never choose one specific variety from several hits. */
export function resolvePantryFood(name: string, lookup: ReadonlyMap<string, Food>): Food | undefined {
  const term = normalizeIngredientName(name);
  if (!term) return undefined;
  const foods = [...lookup.values()];
  const exact = foods.filter(food => [food.name, ...food.aliases].some(n => normalizeIngredientName(n) === term));
  if (exact.length) return exact.length === 1 ? exact[0] : undefined;
  const family = families.find(f => f.inputs.includes(term));
  if (family) {
    const canonical = foods.find(food => normalizeIngredientName(food.name) === family.name);
    return canonical ?? inputFood(`ingredient-family-${family.id}`, family.name, family.inputs.filter(n => n !== family.name));
  }
  const synonyms=inputSynonyms.find(group=>group.includes(term));
  if(synonyms){const hits=foods.filter(f=>[f.name,...f.aliases].some(n=>synonyms.includes(normalizeIngredientName(n))));if(hits.length===1)return hits[0];}
  if (!isQueryName(term)) return undefined;
  const matches = foods.filter(food => !isPantryQueryId(food.id) && compatibleNames([term], [food.name, ...food.aliases]));
  return matches.length ? inputFood(queryId(term), term) : undefined;
}

export function pantryInputNames(lookup: ReadonlyMap<string, Food>): string[] {
  return families.flatMap(f => f.inputs).filter(name => !!resolvePantryFood(name, lookup));
}

/** Runtime-only broad input token; it is not a reviewed nutrition or allergy record. */
export function ingredientFamilyFoods(existing: Food[]): Food[] {
  const known = new Set(existing.flatMap(food => [food.name, ...food.aliases]).map(normalizeIngredientName));
  return families.filter(family => !known.has(family.name)).map(family => inputFood(`ingredient-family-${family.id}`, family.name,
    family.inputs.filter(name => name !== family.name && !known.has(name))));
}

export function findPantryIngredient(line: Line, ingredients: Ingredient[], lookup: ReadonlyMap<string, Food>): IngredientMatch | undefined {
  const exact = ingredients.find(i => i.status === 'confirmed' && i.foodId === line.foodId);
  if (exact) return { ingredient: exact, kind: 'exact' };

  const recipeFood = lookup.get(line.foodId);
  if (!recipeFood) return undefined;
  const recipeNames = [recipeFood.name, ...recipeFood.aliases];
  for (const item of ingredients) {
    if (item.status !== 'confirmed' || !item.foodId) continue;
    const term = normalizeIngredientName(item.name);
    const food = lookup.get(item.foodId) ?? (isQueryName(term) && queryId(term) === item.foodId ? inputFood(item.foodId, term) : resolvePantryFood(item.name, lookup));
    if (food?.id === item.foodId && compatibleNames([food.name, ...food.aliases], recipeNames)) return { ingredient: item, kind: 'broad' };
  }
  return undefined;
}
