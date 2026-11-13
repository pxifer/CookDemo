import type { Food } from './types';

// These IDs are offered only when the connected catalog contains their food record.
export const pantryGroups = [
  { name: '油盐酱醋', ids: ['oil','salt','soy','dark-soy','vinegar','aged-vinegar','sugar','rock-sugar','cooking-wine','sesame-oil','oyster-sauce'] },
  { name: '葱姜蒜与辣味', ids: ['garlic','ginger','scallion','chilli','chilli-powder','douban','chilli-oil'] },
  { name: '香辛料', ids: ['black-pepper','white-pepper','sichuan-pepper','cumin','star-anise','cinnamon','bay-leaf','five-spice'] },
  { name: '勾芡与提鲜', ids: ['starch','msg','chicken-powder'] },
];
const simple = (id: string, name: string, unit: Food['unit'] = 'g', aliases: string[] = [], allergens: string[] = [], complete = true): Food =>
  ({ id, name, unit, aliases, allergens, form: 'raw', componentsComplete: complete, nutrition: {} });
export const extraPantryFoods: Food[] = [
  simple('dark-soy','老抽','ml',[],['soy','wheat'],false), simple('aged-vinegar','陈醋','ml',[],[],false),
  simple('rock-sugar','冰糖'), simple('cooking-wine','料酒','ml',[],[],false), simple('sesame-oil','香油','ml',['芝麻油'],['sesame']),
  simple('oyster-sauce','蚝油','ml',[],['shellfish','soy','wheat'],false), simple('ginger','生姜','g',['姜']), simple('scallion','葱','g',['小葱','香葱']),
  simple('chilli-powder','辣椒粉'), simple('douban','豆瓣酱','g',[],['soy','wheat'],false), simple('chilli-oil','辣椒油','ml',[],[],false),
  simple('black-pepper','黑胡椒','g',['黑胡椒粉']), simple('white-pepper','白胡椒','g',['白胡椒粉']), simple('sichuan-pepper','花椒'),
  simple('cumin','孜然'), simple('star-anise','八角','g',['大料']), simple('cinnamon','桂皮'), simple('bay-leaf','香叶'),
  simple('five-spice','五香粉','g',[],[],false), simple('starch','淀粉','g',['生粉']), simple('msg','味精'),
  simple('chicken-powder','鸡精','g',[],[],false),
];

// Recipe section titles are not food classifications. Keep this vocabulary
// explicit: milk, flour, fish and vegetables still need ordinary stock checks.
const seasoningNames = new Set(`葱 生姜 姜 大蒜 蒜 蒜蓉 淀粉 豆瓣酱 生抽 白糖 红油 孜然籽 食用油 红辣椒粉 印度综合香料粉 盐 料酒 干辣椒粉 蚝油 香叶 花椒 八角 干辣椒 丁香 甘草 郫县豆瓣酱 冰糖 花雕酒 白酒 柱候酱 老抽 叉烧酱 陈醋 花椒粉 鸡精 桂皮 菜籽油 姜片 孜然粉 白胡椒 豉油调味汁 味精 葱花 黄酒 蒜头 白砂糖 鱼露 番茄酱 香醋 地瓜粉 大葱 黑醋 花椒油 花生油 茄汁 白醋 玉米淀粉 黑胡椒粒 黄油 米酒 姜末 红豆腐乳 甜面酱 精盐 红酱油 白酱油 味极鲜 老姜 花椒碎 花椒粒 红薯淀粉 十三香 胡椒粉 植物油 五香粉 猪油 蒜末 辣椒面 食用盐 黑胡椒 米醋 烧烤料 黄豆酱 麻油 蕃茄酱 水淀粉 香油 番茄膏 橄榄油 食用植物油 豆蔻 葱油 辣椒粉 蜂蜜 蒸鱼豉油 白芷 小豆蔻粉 预制牛排酱汁 海盐 白葡萄酒 孜然 无盐黄油 葱白 腐乳汁 蒸肉粉 细辣椒粉 大蒜粒 干辣椒段 青花椒 蒜粉 洋葱粉 泡打粉 芥末 朗姆酒 豆豉 黑胡椒碎 盐焗鸡粉 香果 干线椒 辣椒油 葱段 柱侯酱 腐乳 南乳 砂糖 生抽酱油 土豆淀粉 桂林辣椒酱 菜油 葱结 芝麻酱 熟白芝麻 白芝麻 郫县红油豆瓣酱 甜椒粉 老抽酱油 油泼辣子 蒜蓉辣酱 姜沫 生姜片 蒜片 蒜瓣 小葱 香葱 香葱段 小葱花 葱末 香菜叶 香菜`.split(/\s+/));
const pantryIds = new Set(pantryGroups.flatMap(group => group.ids));
export const isCookingWater = (name: string) => /^(?:水|饮用水|清水|热水|开水|冰水|凉白开水|温水|冷水|凉水|沸水|香菇水)$/.test(name);
export const isSeasoningFood = (food: Pick<Food, 'id' | 'name'>) => pantryIds.has(food.id) || seasoningNames.has(food.name) || ['姜黄粉','香菜粉','姜粉','paprika','Masala'].includes(food.name);
export const isAromatic = (name: string) => /^(?:大葱|小葱|香葱|葱(?:花|段|白|结|末)?|香葱段|小葱花|生姜片?|老姜|姜(?:片|末|沫)?|大蒜粒?|蒜(?:蓉|瓣|头|末|片)?)$/.test(name);
// Group remaining pantry items by cooking role so the settings panel does not dump
// every sauce/spice into one long "其他调料" list.
export function seasoningGroup(name: string): string {
  if (/酱|汁|腐乳|豆豉|鱼露|烧烤料/.test(name)) return '酱料与调味汁';
  if (/醋|酒/.test(name)) return '醋与酒';
  if (/糖|蜂蜜/.test(name)) return '糖与甜味';
  if (/盐|味精|鸡精|味极鲜/.test(name)) return '盐与基础调味';
  if (/味精|鸡精|淀粉|生粉|地瓜粉|泡打粉|蒸肉粉/.test(name)) return '鲜味与勾芡';
  if (/油|黄油|猪油/.test(name)) return '油与脂';
  if (/椒|孜然|八角|桂皮|香叶|五香|十三香|咖喱|姜黄|芥末|豆蔻|白芷|香果|丁香|甘草|香菜|葱|姜|蒜|芝麻|综合香料/.test(name)) return '香辛料与葱姜蒜';
  return '其他调料';
}
export function seasoningStockKey(food: Pick<Food,'id'|'name'>) {
  if (!isAromatic(food.name)) return food.id;
  return /姜/.test(food.name) ? 'ginger' : /蒜/.test(food.name) ? 'garlic' : 'scallion';
}
