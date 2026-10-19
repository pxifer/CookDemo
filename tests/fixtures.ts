import { extractText } from '../shared/extraction';
import { defaultMeal, type Meal, type RecommendationRequest, type Recipe } from '../shared/types';
export function mealWith(input = '鸡肉300g香菇300g西红柿600g鸡蛋5个土豆600g菠菜500g西兰花500g黄瓜400g胡萝卜400g豆腐400g猪肉300g青椒300g牛肉300g虾200g花生100g白菜400g'): Meal {
  const m = defaultMeal();
  m.ingredients = extractText(input).ingredients.map(i => ({ ...i, status: 'confirmed', basis: 'edible' }));
  return m;
}
export function request(meal = mealWith(), extra: Partial<RecommendationRequest> = {}): RecommendationRequest { return { operationId: crypto.randomUUID(), meal, action: 'generate', selected: [], page: 0, previous: [], ...extra }; }
export function simpleRecipe(id: string, inputs: [string, number][], extra: Partial<Recipe> = {}): Recipe {
  return { id, name: id, category: 'veg', homeStyle: true, minutes: 10, servings: 1, image: 'veg', version: 'test-v1', state: 'published', source: { kind: 'constructed', author: 'test', license: 'test', reviewed: false },
    variants: [{ id: `${id}-v`, flavor: '清淡', steps: ['test'], lines: inputs.map(([foodId, amount]) => ({ foodId, amount, unit: foodId === 'egg' ? '个' : 'g', role: 'main', basis: 'edible', form: 'raw' })) }], ...extra };
}
