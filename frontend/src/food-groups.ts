import type { Food, Recipe } from '../../shared/types';
import { isCookingWater, isSeasoningFood } from '../../shared/pantry';
import navigation from '../../datasets/recipes/food-navigation-overrides.json';

const overrides=new Map(Object.entries(navigation.groups).flatMap(([group,names])=>names.map(name=>[name,group] as const)));

// Navigation groups only. They do not participate in allergy or recipe classification.
const groups:[string,RegExp][]=[
  ['肉禽',/猪|牛|羊|鸡(?!蛋|精|粉)|鸭(?!蛋)|鹅|肉|排骨|里脊|牛腩|火腿|香肠|培根|腊肠|肝|腰|肚|蹄|翅|鸡胗/],
  ['鱼虾海鲜',/鱼|虾|蟹|蛤|蛏|贝|蚝|蛎|鲍|鱿|鳝|鱔|海米|章鱼|墨鱼|海参|海蜇/],
  ['蛋类',/蛋/],
  ['菌菇',/菇|蘑|木耳|银耳|秋耳|虫草花|菌/],
  ['豆制品',/豆腐|豆干|豆皮|豆泡|豆丝|腐竹|千张|素鸡|百叶|豆乳/],
  ['奶类',/奶|乳酪|芝士|酸乳/],
  ['主食杂粮',/米|面(?!筋)|粉(?!椒)|燕麦|小麦|荞麦|意面|年糕|馒头|饼|面筋|藜麦/],
  ['蔬菜',/菜|瓜|萝卜|茄|番茄|西红柿|椒|藕|笋|芹|蒜薹|蒜苔|蒜苗|青蒜|韭|豌豆|豆角|四季豆|荷兰豆|扁豆|毛豆|豆芽|豇豆|芸豆|土豆|山药|芋|荸荠|马蹄|洋葱|圆葱|秋葵|莴|茭白|黄花|西兰花|西蓝花|西葫芦|紫甘蓝|花椰|香椿|海带|紫菜|裙带/],
  ['水果',/苹果|梨|桃|橙|橘|柚|柠檬|菠萝|凤梨|芒果|香蕉|草莓|蓝莓|葡萄|荔枝|龙眼|山楂|椰|西瓜|哈密瓜|木瓜|牛油果|橄榄/],
  ['豆类坚果',/豆|花生|核桃|腰果|杏仁|板栗|栗子|芝麻|莲子|红枣|枸杞/],
];
export function foodGroup(name:string):string{
  const reviewed=overrides.get(name.normalize('NFKC').trim());if(reviewed)return reviewed;
  // Explicit navigation exceptions precede broad substring matching. These
  // labels never grant pantry exemptions or ingredient-composition claims.
  if(/肉桂|桂皮|^(?:.*米醋|.*陈醋|.*香醋|.*白醋|.*酱油)$/.test(name))return '调味料';
  if(/核桃|腰果|杏仁|板栗|栗子|莲子|花生/.test(name))return '豆类坚果';
  if(/粉条|粉丝|面粉|米粉|米面/.test(name))return '主食杂粮';
  if(/牛油果/.test(name))return '水果';
  if(/马蹄|慈菇/.test(name))return '蔬菜';
  if(/牛百叶/.test(name))return '肉禽';
  // Specific foods precede misleading substrings: 蟹味菇、鸡蛋、樱桃谷鸭、小米椒。
  for(const label of ['菌菇','豆制品','蛋类','奶类','鱼虾海鲜','肉禽','水果','蔬菜','主食杂粮','豆类坚果']){
    if(groups.find(([group])=>group===label)![1].test(name))return label;
  }
  return groups.find(([,pattern])=>pattern.test(name))?.[0]??'其他食材';
}
export function recipeFoodUsage(recipes:Recipe[]){
  const usage=new Map<string,number>();
  for(const recipe of recipes)for(const variant of recipe.variants)for(const line of variant.lines){
    if(line.role==='seasoning')continue;
    usage.set(line.foodId,(usage.get(line.foodId)??0)+1);
  }
  return usage;
}
export function groupedFoods(foods:Food[],usage?:Map<string,number>){
  const unique=new Map<string,Food>();
  for(const food of foods){
    if(usage&&!usage.has(food.id))continue;
    if(/腌料|调味料/.test(food.name))continue;
    if(!isSeasoningFood(food)&&!isCookingWater(food.name)&&!/^(g|ml|瓣)$/.test(food.name)&&!unique.has(food.name))unique.set(food.name,food);
  }
  const available=[...unique.values()].sort((a,b)=>(usage?.get(b.id)??0)-(usage?.get(a.id)??0)||a.name.localeCompare(b.name,'zh-CN'));
  return ['肉禽','鱼虾海鲜','蛋类','蔬菜','菌菇','豆制品','主食杂粮','奶类','水果','豆类坚果','其他食材']
    .map(name=>({name,foods:available.filter(food=>foodGroup(food.name)===name)})).filter(group=>group.foods.length);
}
