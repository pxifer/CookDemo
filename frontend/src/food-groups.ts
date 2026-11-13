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
export function foodSubgroup(name:string):string{
  const group=foodGroup(name);
  if(group==='肉禽'){
    if(/猪/.test(name))return '猪肉';
    if(/牛/.test(name))return '牛肉';
    if(/羊/.test(name))return '羊肉';
    if(/鸡|鸭|鹅|禽|翅|腿/.test(name))return '禽肉';
    return '其他肉类';
  }
  if(group==='鱼虾海鲜'){
    if(/虾/.test(name))return '虾类';
    if(/蟹/.test(name))return '蟹类';
    if(/贝|蛤|蛏|蚝|蚬|螺|鲍|蛎/.test(name))return '贝类';
    if(/鱼/.test(name))return '鱼类';
    return '其他海鲜';
  }
  if(group==='蔬菜'){
    if(/菜|菠菜|生菜|白菜|芹|韭|香菜|茼蒿|芥|甘蓝|西兰花|西蓝花|花椰/.test(name))return '叶菜与花菜';
    if(/瓜|茄|椒|番茄|西红柿|秋葵|西葫芦|苦瓜|丝瓜|冬瓜|南瓜/.test(name))return '瓜茄类';
    if(/萝卜|土豆|山药|芋|藕|笋|荸荠|马蹄|红薯|洋葱|葱|蒜|姜/.test(name))return '根茎类';
    return '其他蔬菜';
  }
  if(group==='主食杂粮'){
    if(/米|面|粉|年糕|馒头|饼|意面/.test(name))return '米面';
    return '杂粮';
  }
  return group;
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
  return ['猪肉','牛肉','羊肉','禽肉','其他肉类','鱼类','虾类','蟹类','贝类','其他海鲜','蛋类','叶菜与花菜','瓜茄类','根茎类','其他蔬菜','菌菇','豆制品','米面','杂粮','奶类','水果','豆类坚果','其他食材']
    .map(name=>({name,foods:available.filter(food=>foodSubgroup(food.name)===name)})).filter(group=>group.foods.length);
}
