import { matchesListedFood } from './food-restrictions';
import type { ContentContext } from './content';
import type { DietAssessment, HealthChatRequest, SuggestedRecipe } from './health-chat';
import { aiFoodMatch } from './ai-food-choices';

// This is a catalogue illustration of food suggestions, not a meal/inventory check.
export function healthChatRecipes(context:ContentContext,assessment:DietAssessment,meal?:HealthChatRequest['mealContext']):SuggestedRecipe[]{
  if(assessment.stage!=='advice')return [];
  const preferred=assessment.suggestions.filter(item=>item.matchable&&item.direction==='prefer').map(item=>item.foodName);
  const exclusions=[...assessment.suggestions.filter(item=>item.matchable&&item.direction==='avoid').map(item=>item.foodName),...(meal?.aiExcludedFoods??[]),...(meal?.aiFoodChoices?.excluded??[]),...(meal?.aiFoodPreferences?.excluded??[])];
  const restrictions=(meal?.restrictions??[]).map(name=>name.replace(/^(过敏|忌口|待确认)：/,''));
  if(restrictions.some(name=>!context.restrictionTargets(name).length))return [];
  const limited=assessment.suggestions.filter(item=>item.matchable&&item.direction==='limit').map(item=>item.foodName);
  const penalties=new Map<string,number>();
  const order=(a:SuggestedRecipe,b:SuggestedRecipe)=>(penalties.get(a.variantId)??0)-(penalties.get(b.variantId)??0)||b.matchedFoods.length-a.matchedFoods.length;
  const matches:SuggestedRecipe[]=[];
  for(const recipe of context.recipes){
    if(recipe.state!=='published')continue;
    const variants=recipe.variants.flatMap(variant=>{
      if([...exclusions,...restrictions].some(name=>aiFoodMatch(variant,name,context)))return [];
      penalties.set(variant.id,limited.filter(name=>aiFoodMatch(variant,name,context)).length);
      const matchedFoods=preferred.filter(name=>aiFoodMatch(variant,name,context));
      return matchedFoods.length?[{recipeId:recipe.id,variantId:variant.id,name:recipe.name,flavor:variant.flavor,matchedFoods}]:[];
    }).sort(order);
    if(variants[0])matches.push(variants[0]);
  }
  return matches.sort(order).slice(0,6);
}


export function withoutExistingRestrictions(suggestions:import('./health-chat').FoodSuggestion[],names:string[],context:ContentContext){
  const blocked=names.flatMap(name=>context.restrictionTargets(name));
  return suggestions.filter(item=>{
    if(names.some(name=>name.normalize('NFKC')===item.foodName.normalize('NFKC')))return false;
    const targets=context.restrictionTargets(item.foodName);
    const selected=targets.flatMap(id=>context.foodById.has(id)?[context.foodById.get(id)!]:[]),excluded=blocked.flatMap(id=>context.foodById.has(id)?[context.foodById.get(id)!]:[]);
    return !selected.some(food=>matchesListedFood(food,excluded))&&!excluded.some(food=>matchesListedFood(food,selected));
  });
}
export function withoutRepeatedFoodText(text:string,names:string[],context:ContentContext){
  const aliases=[...new Set(names.flatMap(name=>[name,...context.restrictionTargets(name).flatMap(id=>{const food=context.foodById.get(id);return food?[food.name,...food.aliases]:[];})]))].filter(name=>name.length>1);
  return text.split(/(?<=[。！？\n])/).filter(sentence=>!aliases.some(name=>sentence.normalize('NFKC').includes(name.normalize('NFKC')))).join('').trim()||'已为你整理新的食材建议，可在下方查看并选择本餐搭配。';
}
export function mergeHealthProfile(previous:import('./health-chat').HealthProfile|undefined,assessment:DietAssessment):import('./health-chat').HealthProfile{
  const profile=assessment.profile??{conditions:[],goals:[],notes:''};
  const unique=(items:string[])=>[...new Set(items)].slice(0,20);
  const suggestions=[...(previous?.suggestions??[]).filter(old=>!assessment.suggestions.some(item=>item.foodName===old.foodName)),...assessment.suggestions].slice(-20);
  return {conditions:unique([...(previous?.conditions??[]),...profile.conditions]),goals:unique([...(previous?.goals??[]),...profile.goals]),notes:profile.notes||previous?.notes||'',suggestions,updatedAt:new Date().toISOString()};
}

export function expandFoodSuggestions(suggestions:import('./health-chat').FoodSuggestion[],context:ContentContext){
  const result:import('./health-chat').FoodSuggestion[]=[];
  for(const item of suggestions){
    if(context.restrictionTargets(item.foodName).length){if(!result.some(old=>old.foodName===item.foodName))result.push({...item,matchable:true});continue;}
    const brackets=[...item.foodName.matchAll(/[（(]([^）)]+)[）)]/g)].flatMap(match=>match[1].replace(/^(例如|比如|如)[:：]?/,'').split(/[、，,；;]/));
    const plain=item.foodName.replace(/[（(][^）)]*[）)]/g,'').replace(/(.+)和(.+)/,'$1、$2').split(/[、，,；;]/);
    const names=[...new Set([...brackets,...plain].map(name=>name.trim()).filter(name=>name&&name.length<=40))];
    const matched=names.filter(name=>context.restrictionTargets(name).length);
    const expanded=brackets.length?(matched.length?matched:[item.foodName]):plain.length>1?names:[item.foodName];
    for(const foodName of expanded)if(!result.some(old=>old.foodName===foodName))result.push({...item,foodName,matchable:context.restrictionTargets(foodName).length>0});
  }
  return result.slice(0,20);
}
