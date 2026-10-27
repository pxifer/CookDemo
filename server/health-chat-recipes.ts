import type { ContentContext } from '../shared/content';
import type { DietAssessment, HealthChatRequest, SuggestedRecipe } from '../shared/health-chat';
import { aiFoodMatch } from '../shared/ai-food-choices';

// This is a catalogue illustration of food suggestions, not a meal/inventory check.
export function healthChatRecipes(context:ContentContext,assessment:DietAssessment,meal?:HealthChatRequest['mealContext']):SuggestedRecipe[]{
  if(assessment.stage!=='advice')return [];
  const preferred=assessment.suggestions.filter(item=>item.matchable&&item.direction==='prefer').map(item=>item.foodName);
  const exclusions=[...assessment.suggestions.filter(item=>item.matchable&&item.direction!=='prefer').map(item=>item.foodName),...(meal?.aiExcludedFoods??[]),...(meal?.aiFoodChoices?.excluded??[])];
  const restrictions=(meal?.restrictions??[]).map(name=>name.replace(/^(过敏|忌口|待确认)：/,''));
  if(restrictions.some(name=>!context.restrictionTargets(name).length))return [];
  const matches:SuggestedRecipe[]=[];
  for(const recipe of context.recipes){
    if(recipe.state!=='published')continue;
    const variants=recipe.variants.flatMap(variant=>{
      if([...exclusions,...restrictions].some(name=>aiFoodMatch(variant,name,context)))return [];
      const matchedFoods=preferred.filter(name=>aiFoodMatch(variant,name,context));
      return matchedFoods.length?[{recipeId:recipe.id,variantId:variant.id,name:recipe.name,flavor:variant.flavor,matchedFoods}]:[];
    }).sort((a,b)=>b.matchedFoods.length-a.matchedFoods.length);
    if(variants[0])matches.push(variants[0]);
  }
  return matches.sort((a,b)=>b.matchedFoods.length-a.matchedFoods.length).slice(0,6);
}
