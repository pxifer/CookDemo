import { CONTENT_VERSION, type Food, type Line, type Recipe } from './types';
import { contentContext } from './content';

// All entries are constructed development content. No medical or nutrition claims.
const food = (id: string, name: string, aliases: string[] = [], unit: Food['unit'] = 'g', allergens: string[] = []): Food =>
  ({ id, name, aliases, unit, form: 'raw', allergens, componentsComplete: true, nutrition: {} });
export const foods: Food[] = [
  food('tomato', '西红柿', ['番茄']), food('egg', '鸡蛋', ['鸡子'], '个', ['egg']),
  food('spinach', '菠菜'), food('potato', '土豆', ['马铃薯']), food('chicken', '鸡肉', ['鸡胸肉', '鸡胸']),
  food('mushroom', '香菇'), food('broccoli', '西兰花', ['绿花菜']), food('cucumber', '黄瓜'),
  food('carrot', '胡萝卜'), food('tofu', '豆腐', [], 'g', ['soy']),
  food('pork', '猪肉', ['瘦肉']), food('beef', '牛肉'), food('pepper', '青椒'),
  food('shrimp', '虾', ['虾仁', '大虾', '对虾'], 'g', ['shellfish']), food('fish', '鱼', ['鲈鱼', '鲜鱼'], 'g', ['fish']),
  food('peanut', '花生', ['花生米'], 'g', ['peanut']), food('cabbage', '白菜', ['大白菜']),
  food('oil', '食用油', ['油'], 'ml'), food('salt', '盐', ['食盐']),
  { ...food('soy', '生抽', ['酱油'], 'ml', ['soy', 'wheat']), componentsComplete: false },
  food('garlic', '大蒜', ['蒜', '蒜瓣']), food('chilli', '干辣椒', ['辣椒']),
  food('vinegar', '米醋', ['醋'], 'ml'), food('sugar', '白糖', ['糖']),
];
export const foodById = new Map(foods.map(f => [f.id, f]));
export const categories = [
  { name: '海产品', aliases: ['海鲜'], targets: ['fish', 'shrimp'], note: '此测试目录内的鱼、虾；其他海产品未覆盖' },
  { name: '蛋类', aliases: [], targets: ['egg'], note: '此测试目录内的鸡蛋' },
  { name: '豆类', aliases: ['大豆'], targets: ['tofu', 'soy'], note: '此测试目录内的豆腐、生抽；其他豆类未覆盖' },
];
export const diseaseAliases: Record<string, string> = { '高血压': '高血压', '高血压病': '高血压', '糖尿病': '糖尿病', '痛风': '痛风' };
export function findFood(name: string) { return foods.find(f => f.name === name || f.aliases.includes(name)); }
export function restrictionTargets(name: string) {
  const f = findFood(name);
  if (f) return [f.id];
  return categories.find(c => c.name === name || c.aliases.includes(name))?.targets ?? [];
}
const main = (foodId: string, amount: number): Line => ({ foodId, amount, unit: foodById.get(foodId)!.unit, role: 'main', basis: 'edible', form: 'raw' });
const seasoning = (foodId: string, amount: number, optional = false): Line => ({ ...main(foodId, amount), role: 'seasoning', optional });
const recipe = (id: string, name: string, category: Recipe['category'], inputs: [string, number][], steps: string[], minutes = 15, homeStyle = true): Recipe => {
  const base = [...inputs.map(([id, n]) => main(id, n)), seasoning('oil', 6), seasoning('salt', 1), seasoning('garlic', 3, true)];
  return {
    id, name, category, homeStyle, minutes, servings: 1,
    image: category === 'meat' ? 'meat' : category === 'soup' ? 'meal' : 'veg', version: CONTENT_VERSION, state: 'published',
    source: { kind: 'constructed', author: '拾味项目开发构造', license: '项目内开发测试使用；正式发布待内容审定', reviewed: false },
    variants: [
      { id: `${id}-light`, flavor: '清淡', lines: base, steps },
      { id: `${id}-spicy`, flavor: '微辣', lines: [...base.map(l => l.foodId === 'oil' ? { ...l, amount: 8 } : l), seasoning('chilli', 1)],
        steps: ['干辣椒剪段；热锅加入食用油，以小火煸出香味，避免烧焦。', ...steps, '出锅前拌匀辣椒，装盘即可。'] },
    ],
  };
};
export const recipes: Recipe[] = [
  recipe('tomato-egg', '番茄炒蛋', 'veg', [['tomato', 150], ['egg', 1]], ['西红柿洗净切块，鸡蛋打散；蒜切碎。', '热锅下油，倒入蛋液炒至凝固后盛出。', '下西红柿翻炒出汁，倒回鸡蛋，加盐拌匀，炒熟盛出。'], 12),
  recipe('potato', '清炒土豆丝', 'veg', [['potato', 180]], ['土豆去皮切细丝，清水洗去表面淀粉，沥干。', '热锅下油，可加入蒜末，放土豆丝快速翻炒。', '加少量清水焖至熟透，加入盐拌匀出锅。'], 15),
  recipe('spinach', '蒜香菠菜', 'veg', [['spinach', 200]], ['菠菜择洗干净，蒜切末。', '水烧开后放菠菜焯熟，捞出沥水。', '热锅下油，蒜末炒香后放菠菜，加盐翻匀。'], 10),
  recipe('broccoli', '清炒西兰花', 'veg', [['broccoli', 200]], ['西兰花分小朵洗净，蒜切末。', '沸水中焯至断生后沥干。', '热锅下油炒香蒜末，加西兰花、盐和少量清水，炒熟。'], 12),
  recipe('cucumber', '清炒黄瓜片', 'veg', [['cucumber', 180]], ['黄瓜洗净切片。', '热锅下油，可放少量蒜末，倒入黄瓜翻炒。', '炒至断生，加盐拌匀出锅。'], 10),
  recipe('carrot', '清炒胡萝卜丝', 'veg', [['carrot', 150]], ['胡萝卜洗净去皮切丝。', '热锅下油，下胡萝卜丝翻炒，加少量清水。', '焖炒至熟软，加盐拌匀。'], 15),
  recipe('cabbage', '蒜蓉白菜', 'veg', [['cabbage', 200]], ['白菜洗净，菜帮与叶分开切段。', '热锅下油炒香蒜末，先放菜帮炒软。', '放菜叶继续炒至熟透，加盐调味。'], 12),
  recipe('tofu', '香煎豆腐', 'veg', [['tofu', 200]], ['豆腐切片，用厨房纸吸去表面水分。', '锅中下油，放豆腐以中小火煎至两面金黄。', '加入盐和少量水略焖，熟透后出锅。'], 18),
  recipe('chicken-mushroom', '香菇滑鸡', 'meat', [['chicken', 120], ['mushroom', 60]], ['去骨鸡肉切片；香菇去蒂洗净切片，分别使用刀板处理。', '热锅下油，下鸡肉翻炒，再放香菇。', '加少量清水和盐，焖炒至鸡肉中心熟透、香菇熟软后盛出。'], 20),
  recipe('pepper-pork', '青椒肉丝', 'meat', [['pork', 100], ['pepper', 100]], ['猪肉与青椒分别洗净切丝，生熟食处理用具分开。', '热锅下油，先将肉丝炒至变色，再下青椒。', '加盐和少量清水，炒至猪肉熟透、青椒断生。'], 18),
  recipe('beef-carrot', '胡萝卜炒牛肉', 'meat', [['beef', 120], ['carrot', 80]], ['牛肉切薄片；胡萝卜切薄片，分别放置。', '热锅下油，先炒胡萝卜，加少量水焖软。', '加入牛肉翻炒，加盐，炒至牛肉完全熟透。'], 20),
  recipe('shrimp-egg', '虾仁滑蛋', 'meat', [['shrimp', 100], ['egg', 1]], ['虾仁去壳去虾线洗净，鸡蛋打散。', '热锅下油，虾仁炒至完全熟透。', '倒入蛋液，加盐，翻炒至蛋液凝固后出锅。'], 15),
  recipe('tomato-soup', '番茄蛋花汤', 'soup', [['tomato', 100], ['egg', 1]], ['西红柿切块，鸡蛋打散。', '热锅下少量油炒西红柿，加入适量水煮开。', '缓缓淋入蛋液，煮至蛋液凝固，加盐拌匀。'], 12),
  recipe('mushroom-tofu', '香菇豆腐汤', 'soup', [['mushroom', 60], ['tofu', 150]], ['香菇洗净去蒂切片，豆腐切块。', '锅中下油略炒香菇，加适量水煮开。', '放豆腐，小火煮至食材熟透，加盐调味。'], 18),
  recipe('peanut-cucumber', '花生黄瓜小炒', 'veg', [['peanut', 30], ['cucumber', 150]], ['花生洗净沥干，黄瓜切丁。', '锅中下油，小火将花生炒熟，再放黄瓜。', '加盐，翻炒至黄瓜断生后出锅。'], 15, false),
  recipe('chicken-broccoli', '西兰花鸡丁', 'meat', [['chicken', 120], ['broccoli', 150]], ['去骨鸡肉切丁，西兰花分小朵焯水。', '热锅下油，鸡丁炒至熟透。', '放入西兰花，加盐及少量水炒匀。'], 20, false),
  recipe('potato-mushroom', '香菇土豆煲', 'veg', [['potato', 150], ['mushroom', 60]], ['土豆去皮切块，香菇洗净切块。', '锅中下油，加入土豆香菇翻炒，加入适量水。', '加盐，小火焖煮至土豆完全熟软。'], 25, false),
];

export function validateCatalog(catalog: Recipe[]) {
  const ids = new Set<string>();
  for (const r of catalog) {
    if (ids.has(r.id) || !r.variants.length || r.servings <= 0) throw new Error('Invalid recipe');
    ids.add(r.id);
    const mains = (lines: Line[]) => lines.filter(l => l.role === 'main').map(l => l.foodId).sort().join(',');
    const variants = new Set<string>();
    for (const v of r.variants) {
      if (variants.has(v.id) || !v.steps.length || mains(v.lines) !== mains(r.variants[0].lines)) throw new Error('Variant changes main ingredients');
      variants.add(v.id);
      for (const l of v.lines) if (!foodById.has(l.foodId) || l.amount === null || !Number.isFinite(l.amount) || l.amount <= 0) throw new Error('Invalid ingredient');
    }
  }
}
validateCatalog(recipes);
export const constructedContent = contentContext({ contentVersion: CONTENT_VERSION, contentState: 'constructed', foods, recipes, categories });
