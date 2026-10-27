import type { AiFoodChoices } from './health-chat';
import type { ContentContext } from './content';
import type { Meal, Variant } from './types';
import { matchesListedFood } from './food-restrictions';

export const emptyAiChoices = (): AiFoodChoices => ({preferred:[],limited:[],excluded:[]});
export function aiFoodMatch(variant: Variant, name: string, context: ContentContext): boolean {
  const targets=context.restrictionTargets(name).flatMap(id=>context.foodById.get(id)?[context.foodById.get(id)!]:[]);
  return variant.lines.some(line=>Boolean(context.foodById.get(line.foodId)&&matchesListedFood(context.foodById.get(line.foodId)!,targets)));
}
export const aiExcludedFoods=(meal:Meal):string[]=>meal.health?[...new Set([...(meal.aiExcludedFoods??[]),...(meal.aiFoodChoices?.excluded??[])])]:[];
export function aiFoodRank(variant:Variant,meal:Meal,context:ContentContext){
  const choices=meal.health?(meal.aiFoodChoices??{preferred:meal.healthProfile?.suggestions.filter(item=>item.direction==='prefer'&&item.matchable).map(item=>item.foodName)??[],limited:meal.healthProfile?.suggestions.filter(item=>item.direction!=='prefer'&&item.matchable).map(item=>item.foodName)??[],excluded:[]}):undefined;
  return {limited:choices?.limited.filter(name=>aiFoodMatch(variant,name,context)).length??0,preferred:choices?.preferred.filter(name=>aiFoodMatch(variant,name,context)).length??0};
}
