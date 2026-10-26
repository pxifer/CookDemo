import type { Food } from './types';

// Culinary identity only. These groups do not expand packaged foods into their
// ingredients, allergens, nutrients or chemical constituents.
const groups = [
  ['葱','小葱','香葱','大葱','葱白','葱花','葱段','葱结','葱丝','葱片','葱末','葱白末','香葱末'],
  ['大蒜','蒜','蒜头','蒜瓣','蒜籽','独头蒜','蒜蓉','蒜泥','蒜末','蒜片','大蒜粒','蒜粉'],
  ['生姜','姜','老姜','嫩姜','子姜','姜片','姜丝','姜末','姜沫','生姜片','姜粉'],
  ['西红柿','番茄'],['黄瓜','青瓜'],['土豆','马铃薯'],['莴笋','青笋'],['花菜','松花菜'],
  ['蒜苔','蒜薹'],['洋葱','圆葱','黄洋葱'],['西兰花','西蓝花'],['莲藕','藕'],
  ['木耳','黑木耳','干木耳','秋耳','泡发木耳'],['香菇','鲜香菇','干香菇'],
  ['盐','食盐','食用盐','海盐','精盐'],['白糖','糖','白砂糖','砂糖','绵白糖'],
  ['八角','大料'],['桂皮','肉桂皮'],['淀粉','生粉','干淀粉','水淀粉','水生粉','勾芡淀粉','腌制淀粉'],
  ['生抽','生抽酱油'],['老抽','老抽酱油'],['豆瓣酱','豆辦酱','豆瓣辣酱','郫县豆瓣酱','郫县红油豆瓣酱'],
  ['番茄酱','番茄沙司','蕃茄酱','茄汁'],['豆豉','干豆豉','阳江豆豉'],
  ['豆腐皮','豆皮','千张','干豆腐'],['栗子','板栗'],['花生','花生米','熟花生','熟花生米'],
  ['鸡蛋','蛋液','蛋清','蛋黄','鸡蛋黄'],['紫菜','干紫菜'],['味精','味素'],
];
const aliases = new Map(groups.flatMap(group=>group.map(name=>[name,group[0]] as const)));
export const foodNameKey = (name:string) => aliases.get(name.replace(/\s/g,'')) ?? name.replace(/\s/g,'');
const parents: {name:string;pattern:RegExp;exclude?:RegExp}[] = [
  {name:'猪肉',pattern:/猪肉|猪里脊|猪通脊|猪底板肉|五花肉|二刀肉|梅头猪肉|猪瘦肉|纯瘦肉|里脊肉|通脊肉|猪排骨|猪小排|猪前肘|猪蹄|猪手|猪肘|肘子|排骨|肋排|猪肥膘|猪肝/,exclude:/牛|羊|鸡|鸭/},
  {name:'牛肉',pattern:/牛肉|牛腩|牛里脊|牛肋|牛后腿|肥牛|牛排|牛小排|牛肚|牛蹄筋/,exclude:/汤|酱|油/},
  {name:'鸡肉',pattern:/鸡肉|鸡胸|鸡脯|鸡腿|鸡翅|鸡心|鸡胗|鸡肝|鸡蓉|乌鸡|仔鸡|公鸡|土鸡|清远鸡|^鸡$/,exclude:/鸡蛋|鸡精|鸡粉|鸡汁|鸡油|鸡汤/},
  {name:'鸭肉',pattern:/鸭肉|鸭腿|鸭心|鸭胗|鸭子|鸭血/},
  {name:'羊肉',pattern:/羊肉|羊排|羊腩|羊里脊|羊通脊|羊杂/,exclude:/汤|酱|油/},
  {name:'鱼',pattern:/鱼|鳝|鱔/,exclude:/鱼香|八爪鱼|墨鱼|鱿鱼|鱼露|鱼丸|鱼汤|鱼汁|蒸鱼|鱼籽|乌鱼蛋/},
  {name:'虾',pattern:/虾/,exclude:/虾油|虾酱|虾汁/},
  {name:'辣椒',pattern:/椒/,exclude:/胡椒|花椒|藤椒|酱|油|盐/},
  {name:'青椒',pattern:/青椒|青辣椒|螺丝椒|尖椒|菜椒|青红椒|青红尖椒|绿尖椒|青尖椒/,exclude:/油|酱|粉/},
  {name:'白菜',pattern:/白菜|娃娃菜/,exclude:/圆白菜|泡菜|酸菜|辣白菜/},
  {name:'豆腐',pattern:/^(北|南|老|嫩|白|盒|内酯|油炸|油)?豆腐$/},
  {name:'蘑菇',pattern:/菇|口蘑/},
  {name:'酱油',pattern:/^(生抽|老抽|生抽酱油|老抽酱油|味极鲜|味极鲜酱油|豉油|白酱油|红酱油|鲜酱油|酱油)$/},
];
export function listedFoodKeys(food:Pick<Food,'name'|'aliases'>):string[]{
  const names=[food.name,...food.aliases];
  return [...new Set(names.flatMap(name=>[foodNameKey(name),...parents.filter(parent=>parent.pattern.test(name)&&!parent.exclude?.test(name)).map(parent=>foodNameKey(parent.name))]))];
}
export function matchesListedFood(food:Food,targets:readonly Food[]):boolean{
  const keys=new Set(listedFoodKeys(food));
  return targets.some(target=>target.id===food.id||[target.name,...target.aliases].some(name=>keys.has(foodNameKey(name))));
}
