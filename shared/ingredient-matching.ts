import type { Food, Ingredient, Line } from './types';

export type IngredientMatch = { ingredient: Ingredient; kind: 'exact' | 'broad' };

/**
 * Explicitly recognized broad pantry categories. A family match only helps find a
 * recipe; it never proves that a cut, variety, processing form, or quantity fits.
 * Keep these patterns narrow so unrelated staples (for example rice noodles) do
 * not become interchangeable with vermicelli.
 *
 * `recipeNames` also drives picker grouping; `matchNames` is the stricter test used to
 * decide whether a pantry item covers a recipe ingredient. Holding "猪肉" means holding a
 * piece of muscle, not the bones, offal, skin, fat or cured products sold separately.
 */
type Family = { id: string; name: string; inputs: string[]; recipeNames: RegExp; excludedRecipeNames?: RegExp; matchNames?: (name: string) => boolean };
const notAPieceOfMeat = /骨|排骨|肋排|小排|肋|肝|腰|肚|肠|心|肺|血|横脷|(?:猪|牛|羊|鸡|鸭|鹅|鱼)皮|皮冻|油|脚|手|蹄|尾|肘|(?:猪|牛|羊|鸡|鸭|鹅)头|脑|耳|舌|筋|爪|掌|脖|胗|杂|丸|松|腊|咸|卤|酱|叉烧|火腿|培根|香肠|午餐肉|罐头|风干|熏|汤|高汤|精|粉|蛋|奶|籽/;
const muscle = (words: RegExp) => (name: string) => words.test(name) && !notAPieceOfMeat.test(name);
const families: Family[] = [
  { id: 'egg', name: '鸡蛋', inputs: ['鸡蛋', '蛋', '蛋液', '蛋清', '蛋黄', '土鸡蛋'], recipeNames: /蛋/,
    // Parts of an egg are the egg; preserved or other birds' eggs are their own thing.
    matchNames: (name: string) => /^(?:鸡蛋|蛋|蛋液|蛋清|蛋黄|鸡蛋清|鸡蛋黄|土鸡蛋|笨鸡蛋|常温鸡蛋)$/.test(name),
    excludedRecipeNames: /鸭蛋|皮蛋|鹌鹑蛋|鸽子蛋|墨鱼蛋|咸蛋|鸡蛋干|蛋饺|蛋糕|蛋挞/ },
  { id: 'pork', name: '猪肉', inputs: ['猪肉', '瘦肉'],
    recipeNames: /猪|五花|梅花|二刀|梅头|里脊|里几|通脊|夹心|坐臀|臀尖|底板|颊肉|肥膘|瘦肉|排骨|肋排|肘子|筒子骨|扇骨|龙骨|小排|大肠|小肠|肉馅|肉末|肉片|肉丝|肉丁|肉块|^肉$/,
    // Muscles and their everyday cut names; 二刀肉/梅头肉/通脊/底板 are pork cuts too.
    matchNames: muscle(/猪|五花|梅花|二刀|梅头|里脊|里几|通脊|夹心|坐臀|臀尖|底板|颊肉|肥膘|瘦肉|^(?:肉|肉丝|肉片|肉末|肉馅|肉丁|肉块)$/),
    excludedRecipeNames: /猪油|猪皮|牛|羊|鸡|鸭|鹅|鱼|虾/ },
  { id: 'chicken', name: '鸡肉', inputs: ['鸡肉', '鸡'], recipeNames: /鸡/,
    matchNames: muscle(/鸡/),
    excludedRecipeNames: /鸡蛋|鸡精|鸡粉|鸡汤|鸡油|鸡枞|鸡腿菇|鸡汁|鸡酱|腌料|调料/ },
  { id: 'duck', name: '鸭肉', inputs: ['鸭肉', '鸭'], recipeNames: /鸭/,
    matchNames: muscle(/鸭/),
    excludedRecipeNames: /鸭蛋|鸭油/ },
  { id: 'goose', name: '鹅肉', inputs: ['鹅肉', '鹅'], recipeNames: /鹅/,
    matchNames: muscle(/鹅/),
    excludedRecipeNames: /鹅蛋|鹅油/ },
  { id: 'beef', name: '牛肉', inputs: ['牛肉'], recipeNames: /牛/,
    matchNames: muscle(/牛/),
    excludedRecipeNames: /牛奶|牛油|牛油果|牛骨/ },
  { id: 'lamb', name: '羊肉', inputs: ['羊肉'], recipeNames: /羊/,
    matchNames: muscle(/羊/),
    excludedRecipeNames: /羊奶/ },
  { id: 'fish', name: '鱼', inputs: ['鱼', '鲜鱼'], recipeNames: /鱼/,
    matchNames: muscle(/鱼/),
    // 墨鱼/鱿鱼/章鱼 are molluscs, not fish.
    excludedRecipeNames: /墨鱼|鱿鱼|章鱼|八爪|鲍鱼|鱼露|鱼丸|鱼豆腐|鱼粉|鱼皮|鱼籽|鱼腥草|鱼汁|鱼酱/ },
  { id: 'shrimp', name: '虾', inputs: ['虾', '大虾', '鲜虾'], recipeNames: /虾/,
    excludedRecipeNames: /虾皮|虾酱|虾粉|虾米|虾油|虾汁/ },
  { id: 'crab', name: '蟹', inputs: ['蟹', '螃蟹'], recipeNames: /蟹/,
    excludedRecipeNames: /蟹味菇|蟹棒|蟹柳|蟹黄酱/ },
  { id: 'shellfish', name: '贝类', inputs: ['贝类', '贝', '蛤蜊', '花蛤', '扇贝', '蚝'], recipeNames: /贝|蛤|蛏|蚝|蚬|螺|鲍|蛎/,
    excludedRecipeNames: /螺蛳粉|贝壳粉|蚝油|贝汁|贝酱|菇|蘑/ },
  { id: 'vermicelli', name: '粉条', inputs: ['粉条', '粉丝'], recipeNames: /(?:粉条|粉丝|宽粉)/,
    excludedRecipeNames: /米粉|面粉|淀粉/ },
  { id: 'mushroom', name: '蘑菇', inputs: ['蘑菇', '菌菇'], recipeNames: /(?:菇|口蘑|白蘑)/ },
  { id: 'tofu', name: '豆腐', inputs: ['豆腐'], recipeNames: /^(?:白|老|嫩|南|北|内酯|水)?豆腐$/ },
  { id: 'cabbage', name: '白菜', inputs: ['白菜'], recipeNames: /(?:白菜|娃娃菜)/,
    excludedRecipeNames: /酸菜|腌|泡菜|圆白菜/ },
  { id: 'pepper', name: '青椒', inputs: ['青椒'], recipeNames: /(?:青椒|螺丝椒|尖椒|菜椒|青红椒)/,
    excludedRecipeNames: /干|泡|腌/ },
  { id: 'broccoli', name: '西兰花', inputs: ['西兰花', '西蓝花', '绿花菜'], recipeNames: /(?:西兰花|西蓝花|绿花菜)/, excludedRecipeNames: /花胶/ },
  { id: 'cauliflower', name: '花菜', inputs: ['花菜', '菜花'], recipeNames: /(?:花菜|菜花)/, excludedRecipeNames: /黄花菜/ },
];

// Parser leakage from recipe text: counts ("几个"、"二颗") followed a quantifier, so match the
// quantifier anywhere, not only as a whole token. Keep real foods (八角、五花肉) out of the
// blacklist by requiring the counting word right after the quantifier.
const countingUnits = '个|颗|粒|块|片|根|条|只|朵|把|勺|匙|杯|碗|串|张|节|段|颗|棵|株|枝|瓣|枚|双|对|斤|两|克|毫升|盒|袋|罐|瓶|包|汤匙|茶匙|点点';
const amountPrefix = '0-9０-９一二两三四五六七八九十百千半几些好多数点到';
// 多/很 are vague qualifiers ("很多"), not amounts, so they only participate in stripping.
const vaguePrefix = '多很';
const quantityNames = new RegExp(`^(?:[${amountPrefix}]{1,4})(?:${countingUnits})?(?:左右|大小|多个|若干)?$`
  + `|^(?:适量|少许|少量|若干|一些|些许|中等|中等大小|大块|小块|一大块|一小块|大|小|中)$`
  + `|^(?:[0-9]{1,4})(?:g|kg|ml|l|克|克重|毫升|升|斤|两)(?:左右)?$`);
const fragmentNames = /^(?:大|小|中|去)?(?:块|片|根|颗|粒|朵|条|只|个|段|节|张|串|把|勺|杯|碗)$|^(?:若干|几个|几颗|数个|少许|适量|随便|任意|其他|其它|以上|以下|如下|同上|以上材料|全部|所有|各种|各类|各种材料)$/;
// Real foods that read like "numeral + counting unit". Without these, 千张 (tofu skin)
// is deleted as if it were "thousand + sheet".
const amountLookalikeFoods = new Set(['千张','百叶','八角','二荆条','三文鱼','五花肉','十三香','丁香','三杯鸡','一品鲜']);
const entireAmount = new RegExp(`^[${amountPrefix}]+(?:大|小|中)?(?:${countingUnits})$`);
const standaloneUnit = new RegExp(`^(?:${countingUnits})$`);
// A bare unit left behind when a source writes "200 g" / "10 ml" with a space.
const bareUnit = /^(?:g|kg|ml|l|克|毫升|升|斤|两)$/i;
export function isInvalidFoodName(name:string):boolean{
  const term=name.normalize('NFKC').trim();
  if(!term)return true;
  if(amountLookalikeFoods.has(term))return false;
  if(bareUnit.test(term))return true;
  if(standaloneUnit.test(term))return true;
  if(/[0-9０-９]/.test(term)&&term.length<=6&&new RegExp(`(?:${countingUnits}|g|kg|ml)$`,'i').test(term))return true;
  // Chinese counts/amounts with no real noun left: 一到、二棵、几个、十几、半把、很多.
  const head=term.replace(new RegExp(`[${amountPrefix}${vaguePrefix}\\s~～\\-至左右大小]+`,'gu'),'');
  if(term.length<=4&&!head)return true;
  if(entireAmount.test(term))return true;
  return quantityNames.test(term)||fragmentNames.test(term);
}
export function canonicalIngredientName(name:string):string{
  const normalized=normalizeIngredientName(name);
  if(/鸡蛋|蛋液|鸡蛋黄|蛋黄|蛋清|土鸡蛋|笨鸡蛋|常温鸡蛋|^蛋$/.test(normalized)&&!/干|酱|饺|糕|挞|皮/.test(normalized))return '鸡蛋';
  if(/鸭蛋/.test(normalized))return '鸭蛋';
  // A cut collapses into the broad name only when the matcher agrees that the broad term
  // covers it. Otherwise it stays selectable on its own (排骨、猪肝、猪蹄、腊肉…), so the
  // picker and the matcher never disagree about what "猪肉" means.
  const family=families.find(item=>item.recipeNames.test(normalized)&&!item.excludedRecipeNames?.test(normalized)
    &&(item.matchNames?item.matchNames(normalized):true));
  if(family)return family.name;
  const synonyms=inputSynonyms.find(group=>group.includes(normalized));
  return synonyms?.[0]??name;
}
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
  // Proven synonyms are the same food under different names (包菜 = 卷心菜).
  if (pantry.some(p => recipe.some(r => p !== r && inputSynonyms.some(group => group.includes(p) && group.includes(r))))) return true;
  // Free text keeps the words the user typed ("肉丝"), while the picker shows the collapsed
  // name ("猪肉"). A family member test keeps both paths agreeing without widening the term:
  // 肉丝 is a pork cut, while 大白菜 must not become the broader 白菜 for covering 小白菜.
  const family = families.find(f => pantry.some(p => f.inputs.includes(p) || Boolean(f.matchNames?.(p))));
  if (family) return recipe.some(r => family.recipeNames.test(r) && !family.excludedRecipeNames?.test(r)
    && (family.matchNames ? family.matchNames(r) : true)
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
// A group means "the same shopping item under a different name", so matching is symmetric:
// holding 圆葱 covers a recipe that asks for 洋葱, and the other way round. Names that are
// different products (青椒 vs 红椒, 大白菜 vs 小白菜, 大葱 vs 小葱) stay apart.
const inputSynonyms = [
  ['小番茄','小西红柿','樱桃番茄','圣女果'],
  ['番茄','西红柿'],
  ['马铃薯','土豆','洋芋'],
  ['卷心菜','洋白菜','包菜','圆白菜'],
  ['青花菜','西兰花'],
  ['洋葱','圆葱'],
  ['小米辣','小米椒'],
  ['豆角','豇豆','长豆角','长豇豆'],
  ['红椒','红辣椒','红尖椒'],
  ['芹菜','西芹'],
  ['豆芽','绿豆芽','黄豆芽','黑豆芽'],
  ['玉米','玉米粒','甜玉米粒'],
  ['豆腐','北豆腐','老豆腐','嫩豆腐','南豆腐','内酯豆腐','水豆腐'],
  ['白菜','娃娃菜','白菜心'],
  ['排骨','猪排骨','肋排','猪肋排'],
  ['花生','花生米','花生仁'],
  ['莴笋','莴苣'],
  ['香菜','芫荽'],
  ['红薯','地瓜','番薯','山芋'],
  ['蒜苔','蒜薹'],
  ['咸鸭蛋','熟咸鸭蛋','生咸鸭蛋','咸蛋'],
  ['二荆条','二荊条'],
];
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
