import { recipes, foods, categories } from '../shared/catalog';
import type { ContentSnapshot } from '../shared/content';

export const BUSINESS_RELEASE = 'local-business-v1';
export function businessFixture(version = BUSINESS_RELEASE): ContentSnapshot {
  const data: ContentSnapshot = structuredClone({ contentVersion: version, contentState: 'database-constructed', foods, recipes, categories, relations: [] });
  data.foods.find(f => f.id === 'salt')!.nutrition = { kcal: 0, protein: 0, sodium: 2000 };
  data.foods.push({ id:'local-zucchini', name:'构造西葫芦', aliases:['构造角瓜'], unit:'g', form:'raw', allergens:[], componentsComplete:true,
    nutrition:{ kcal:20, protein:2 } }); // Deliberately synthetic; sodium is missing, not zero.
  data.categories.push({ name:'构造瓜类', aliases:[], targets:['local-zucchini','cucumber'], note:'本地构造范围：西葫芦、黄瓜；请核对后确认' });
  data.recipes.push({ id:'local-zucchini', name:'构造西葫芦小炒', category:'veg', homeStyle:true, minutes:10, servings:1, image:'veg',
    version, state:'published', source:{kind:'constructed',author:'local fixture',license:'仅开发测试',reviewed:false},
    variants:[
      {id:'local-zucchini-light',flavor:'清淡',lines:[
        {foodId:'local-zucchini',amount:100,unit:'g',role:'main',basis:'edible',form:'raw'},
        {foodId:'salt',amount:1,unit:'g',role:'seasoning',basis:'edible',form:'raw'},
      ],steps:['构造步骤一：核对测试食材。','构造步骤二：完成测试流程；本数据不作为真实食谱。']},
      {id:'local-zucchini-spicy',flavor:'微辣',lines:[
        {foodId:'local-zucchini',amount:150,unit:'g',role:'main',basis:'edible',form:'raw'},
        {foodId:'salt',amount:1.5,unit:'g',role:'seasoning',basis:'edible',form:'raw'},
      ],steps:['构造微辣步骤：仅验证变体和用量读取，不代表真实配方。']},
    ] });
  return data;
}
