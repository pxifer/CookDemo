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
    defaults={...local.defaults,restrictions:[...merged.values()]};
  }
  return {favorites,defaults};
}

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
      restrictions:same(local.defaults.restrictions,base.defaults.restrictions)?remote.defaults.restrictions:same(remote.defaults.restrictions,base.defaults.restrictions)?local.defaults.restrictions:merged.defaults!.restrictions};
  }
  return merged;
}
