import { emptyAiChoices, mergeAiChoices } from './ai-food-choices';
import type { AccountValue } from './account';
import type { Meal, Restriction } from './types';

export function mergeAccountValues(local:AccountValue,cloud:AccountValue):AccountValue {
  const favorites=[...new Map([...cloud.favorites,...local.favorites].map(f=>[`${f.recipeId}:${f.variantId}`,f])).values()];
  if(favorites.length>100)throw Error('合并后收藏超过100项，请先移除一些');
  let defaults:Meal|null=local.defaults??cloud.defaults;
  if(local.defaults&&cloud.defaults){
    const merged=new Map<string,Restriction>();
    for(const restriction of [...cloud.defaults.restrictions,...local.defaults.restrictions]){
      const key=JSON.stringify([restriction.kind,restriction.name,restriction.scope]),previous=merged.get(key);
      if(!previous){merged.set(key,{...restriction,targets:[...restriction.targets]});continue;}
      const targets=[...new Set([...previous.targets,...restriction.targets])];
      if(targets.length>50)throw Error('饮食要求范围过多，请先逐项核对');
      const equivalent=previous.status===restriction.status&&previous.targets.length===restriction.targets.length&&previous.targets.every(id=>restriction.targets.includes(id));
      merged.set(key,{...previous,targets,status:equivalent?previous.status:'conflict',original:[...new Set([previous.original,restriction.original])].join('；')});
    }
    if(merged.size>50)throw Error('合并后饮食要求超过50项，请先逐项整理');
    const aiExcludedFoods=[...new Set([...(remoteFoods(cloud.defaults)),...remoteFoods(local.defaults)])];
    if(aiExcludedFoods.length>20)throw Error('合并后AI去疾超过20项，请先整理');
    const preferences=mergeAiChoices(emptyAiChoices(),{preferred:[...(cloud.defaults.aiFoodPreferences?.preferred??[]),...(local.defaults.aiFoodPreferences?.preferred??[])],limited:[...(cloud.defaults.aiFoodPreferences?.limited??[]),...(local.defaults.aiFoodPreferences?.limited??[])],excluded:[...(cloud.defaults.aiFoodPreferences?.excluded??[]),...(local.defaults.aiFoodPreferences?.excluded??[])]});
    if(Object.values(preferences).some(items=>items.length>20))throw Error('合并后AI食材选择超过20项，请先整理');
    defaults={...local.defaults,...(local.defaults.aiFoodPreferences||cloud.defaults.aiFoodPreferences?{aiFoodPreferences:preferences}:{}),restrictions:[...merged.values()],...(aiExcludedFoods.length||local.defaults.aiExcludedFoods||cloud.defaults.aiExcludedFoods?{aiExcludedFoods}:{})};
  }
  return {favorites,defaults};
}

const remoteFoods=(meal:Meal)=>meal.aiExcludedFoods??[];
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function reconcileAccountValues(local:AccountValue,remote:AccountValue,base:AccountValue):AccountValue {
  if(same(local,base))return remote;
  if(same(remote,base))return local;
  const merged=mergeAccountValues(local,remote);
  const key=(f:AccountValue['favorites'][number])=>`${f.recipeId}:${f.variantId}`;
  const before=new Set(base.favorites.map(key)),here=new Set(local.favorites.map(key)),there=new Set(remote.favorites.map(key));
  merged.favorites=merged.favorites.filter(f=>!before.has(key(f))||(here.has(key(f))&&there.has(key(f))));
  if(local.defaults&&remote.defaults&&base.defaults){
    merged.defaults={...merged.defaults!,flavor:same(local.defaults.flavor,base.defaults.flavor)?remote.defaults.flavor:local.defaults.flavor,
      checkSeasonings:same(local.defaults.checkSeasonings,base.defaults.checkSeasonings)?remote.defaults.checkSeasonings:local.defaults.checkSeasonings,
      seasonings:same(local.defaults.seasonings,base.defaults.seasonings)?remote.defaults.seasonings:local.defaults.seasonings,
      aiFoodPreferences:same(local.defaults.aiFoodPreferences,base.defaults.aiFoodPreferences)?remote.defaults.aiFoodPreferences:same(remote.defaults.aiFoodPreferences,base.defaults.aiFoodPreferences)?local.defaults.aiFoodPreferences:reconcilePreferences(local.defaults.aiFoodPreferences,remote.defaults.aiFoodPreferences,base.defaults.aiFoodPreferences),
      healthProfile:same(local.defaults.healthProfile,base.defaults.healthProfile)?remote.defaults.healthProfile:same(remote.defaults.healthProfile,base.defaults.healthProfile)?local.defaults.healthProfile:base.defaults.healthProfile&&(!local.defaults.healthProfile||!remote.defaults.healthProfile)?undefined:remote.defaults.healthProfile,
      aiExcludedFoods:[...new Set([...remoteFoods(local.defaults),...remoteFoods(remote.defaults)])].filter(name=>!remoteFoods(base.defaults!).includes(name)||(remoteFoods(local.defaults!).includes(name)&&remoteFoods(remote.defaults!).includes(name))),
      restrictions:same(local.defaults.restrictions,base.defaults.restrictions)?remote.defaults.restrictions:same(remote.defaults.restrictions,base.defaults.restrictions)?local.defaults.restrictions:merged.defaults!.restrictions};
  }
  return merged;
}

function reconcilePreferences(local:import('./health-chat').AiFoodChoices|undefined,remote:import('./health-chat').AiFoodChoices|undefined,base:import('./health-chat').AiFoodChoices|undefined){
  const result=emptyAiChoices();for(const kind of ['preferred','limited','excluded'] as const)result[kind]=[...new Set([...(local?.[kind]??[]),...(remote?.[kind]??[])])].filter(name=>!(base?.[kind]??[]).includes(name)||Boolean(local?.[kind].includes(name)&&remote?.[kind].includes(name)));
  return mergeAiChoices(emptyAiChoices(),result);
}
