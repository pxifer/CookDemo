import { businessFixture } from '../../tests/content-fixture';
import { extraPantryFoods } from '../../shared/pantry';
import type { Variant } from '../../shared/types';

export const UI_RELEASE = 'local-business-ui-v2';
// A new reversible local fixture release, never a formal recipe approval.
export function localUiContent(version = UI_RELEASE) {
  const data = businessFixture(version);
  data.foods.push(...structuredClone(extraPantryFoods));
  const flavors: Record<string, string[]> = {
    'tomato-egg':['咸鲜','酸甜'], potato:['咸鲜','微辣'], spinach:['蒜香','微辣'], broccoli:['蒜香','微辣'],
    cucumber:['清鲜','微辣'], carrot:['咸鲜','微辣'], cabbage:['蒜香','微辣'], tofu:['咸鲜','微辣'],
    'chicken-mushroom':['咸鲜','微辣'], 'pepper-pork':['咸鲜','香辣'], 'beef-carrot':['咸鲜','黑椒'],
    'shrimp-egg':['咸鲜'], 'tomato-soup':['清鲜'], 'mushroom-tofu':['清鲜'],
    'peanut-cucumber':['咸鲜','酸辣'], 'chicken-broccoli':['蒜香','香辣'], 'potato-mushroom':['咸鲜','酱香'],
  };
  const add = (v: Variant, foodId: string, amount: number, unit: 'g'|'ml' = 'g') =>
    v.lines.push({foodId,amount,unit,role:'seasoning',basis:'edible',form:'raw'});
  for (const recipe of data.recipes) {
    const names = flavors[recipe.id]; if (!names) continue;
    recipe.variants = recipe.variants.slice(0,names.length).map((v,i) => ({...v,flavor:names[i]}));
    if (recipe.id === 'tomato-egg') {
      recipe.imageUrl = '/assets/recipes/tomato-scrambled-eggs-finedining-v1.png';
      const sweet = recipe.variants[1]; sweet.lines = sweet.lines.filter(l => l.foodId !== 'chilli'); add(sweet,'sugar',3);
      sweet.steps = [...recipe.variants[0].steps.slice(0,-1),'下西红柿翻炒出汁，倒回鸡蛋，加盐与白糖拌匀，炒熟盛出。'];
    }
    if (recipe.id === 'beef-carrot') {
      const v = recipe.variants[1]; v.lines = v.lines.filter(l => l.foodId !== 'chilli'); add(v,'black-pepper',0.5);
      v.steps = [...recipe.variants[0].steps,'出锅前撒入配方中的黑胡椒，翻匀。'];
    }
    if (recipe.id === 'potato-mushroom') {
      const v=recipe.variants[1]; v.lines=v.lines.filter(l=>l.foodId!=='chilli'); add(v,'soy',5,'ml');
      v.steps=[...recipe.variants[0].steps,'焖煮时加入配方中的生抽，收至汤汁略浓。'];
    }
    if (recipe.id === 'peanut-cucumber') { add(recipe.variants[1],'vinegar',5,'ml'); recipe.variants[1].steps.push('出锅前沿锅边淋入米醋，翻匀。'); }
    if (recipe.id === 'potato') {
      const v=structuredClone(recipe.variants[1]); v.id='potato-sour-spicy'; v.flavor='酸辣'; add(v,'vinegar',5,'ml');
      v.steps.push('出锅前沿锅边加入米醋，翻炒均匀。'); recipe.variants.push(v);
    }
  }
  return data;
}
