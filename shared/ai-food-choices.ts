import type { AiFoodChoices } from './health-chat';
import type { ContentContext } from './content';
import type { Meal, Variant } from './types';
import { matchesListedFood } from './food-restrictions';

export const emptyAiChoices = (): AiFoodChoices => ({preferred:[],limited:[],excluded:[]});
export function aiFoodMatch(variant: Variant, name: string, context: ContentContext): boolean {
  const targets=context.restrictionTargets(name).flatMap(id=>context.foodById.get(id)?[context.foodById.get(id)!]:[]);
  return variant.lines.some(line=>Boolean(context.foodById.get(line.foodId)&&matchesListedFood(context.foodById.get(line.foodId)!,targets)));
}
export function mergeAiChoices(base:AiFoodChoices,change:AiFoodChoices):AiFoodChoices{
  const next=structuredClone(base),changed=new Set([...change.preferred,...change.limited,...change.excluded]);
  for(const kind of ['preferred','limited','excluded'] as const)next[kind]=[...new Set([...next[kind].filter(name=>!changed.has(name)),...change[kind]])];
  next.limited=next.limited.filter(name=>!next.excluded.includes(name));next.preferred=next.preferred.filter(name=>!next.excluded.includes(name)&&!next.limited.includes(name));return next;
}
export const effectiveAiChoices=(meal:Meal)=>meal.health?mergeAiChoices(meal.aiFoodPreferences??emptyAiChoices(),meal.aiFoodChoices??emptyAiChoices()):emptyAiChoices();
export const aiExcludedFoods=(meal:Meal):string[]=>meal.health?[...new Set([...(meal.aiExcludedFoods??[]),...(meal.aiFoodPreferences?.excluded??[]),...effectiveAiChoices(meal).excluded])]:[];
export function aiFoodRank(variant:Variant,meal:Meal,context:ContentContext){
  const choices=effectiveAiChoices(meal);
  return {limited:choices.limited.filter(name=>aiFoodMatch(variant,name,context)).length,preferred:choices.preferred.filter(name=>aiFoodMatch(variant,name,context)).length};
}
