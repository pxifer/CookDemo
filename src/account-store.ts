import { ApiError, establishSession, loadAccount, saveAccount, updateHealthApiKey } from './api';
import type { AccountSnapshot, AccountValue } from '../shared/account';
import { emptyAccount, personalSettings } from '../shared/account';
import { mergeAccountValues, reconcileAccountValues as reconcile } from '../shared/account-merge';
import type { SessionInfo } from '../shared/session';
import { readFavorites, readValue, writeValue, setStorageOwner, writeGalleryFavorites, galleryFavoriteKey, storageKey } from './storage';
export { mergeAccountValues } from '../shared/account-merge';
import { validateMeal } from './meal-validator.js';
import type { ContentSnapshot } from '../shared/content';

type State={session:SessionInfo|null;status:'loading'|'guest'|'ready'|'saving'|'review'|'error';cloud:AccountSnapshot|null;local:AccountValue;message:string;guest:AccountValue|null};
let state:State={session:null,status:'loading',cloud:null,local:emptyAccount(),message:'',guest:null};
const listeners=new Set<()=>void>();
const emit=(update:Partial<State>)=>{state={...state,...update};listeners.forEach(fn=>fn());};
export const subscribeAccount=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export const accountState=()=>state;
let applying=false,writing=false,timer:ReturnType<typeof setTimeout>|undefined,catalog:ContentSnapshot|undefined;
let generation=0;
export function setAccountCatalog(content:ContentSnapshot){catalog=content;if(state.session?.identity!=='account')return;applying=true;try{writeGalleryFavorites(state.local.favorites.flatMap(f=>{const r=content.recipes.find(r=>r.id===f.recipeId),v=r?.variants.find(v=>v.id===f.variantId);return r&&v?[galleryFavoriteKey(r.name,v.flavor)]:[];}));}finally{applying=false;}}
const value=():AccountValue=>{const defaults=readValue('shiwei:guest:defaults:v1');return {favorites:readFavorites(),defaults:validateMeal(defaults)?personalSettings(defaults):null};};
const nonempty=(v:AccountValue)=>v.favorites.length>0||v.defaults!==null;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function savePersonalSettings(meal:import('../shared/types').Meal){
  if(state.session?.identity!=='account'||state.session.mustChangePassword)return;
  const next=personalSettings(meal);
  if(!same(value().defaults,next))writeValue('shiwei:guest:defaults:v1',next);
}
function apply(remote:AccountValue){
  applying=true;
  try{
    emit({local:remote});
    writeValue('shiwei:guest:favorites:v1',remote.favorites);
    writeValue('shiwei:guest:defaults:v1',remote.defaults);
    if(catalog)writeGalleryFavorites(remote.favorites.flatMap(f=>{const r=catalog!.recipes.find(r=>r.id===f.recipeId),v=r?.variants.find(v=>v.id===f.variantId);return r&&v?[galleryFavoriteKey(r.name,v.flavor)]:[];}));
    window.dispatchEvent(new Event('shiwei:account-applied'));
  }finally{applying=false;}
}
function acknowledge(snapshot:AccountSnapshot){writeValue('shiwei:guest:sync-base:v1',snapshot);}
function changed(){
  if(applying||state.session?.identity!=='account'||state.status==='review'||state.session.mustChangePassword)return;
  emit({local:value()});clearTimeout(timer);timer=setTimeout(()=>void syncAccount(),500);
}
export async function initializeAccount(content?:ContentSnapshot,supplied?:SessionInfo,imported?:AccountValue) {
  const epoch=++generation;clearTimeout(timer);writing=false;
  if(content)catalog=content;
  try {
    const session=supplied??await establishSession(true);
    if(epoch!==generation)return;
    const guest=(()=>{setStorageOwner(null);return value();})();
    setStorageOwner(session.identity==='account'?session.userId!:null);
    emit({session,local:value(),guest:null});
    if(session.identity!=='account'){emit({status:'guest',cloud:null,message:''});return;}
    if(session.mustChangePassword){emit({status:'review',message:'请先修改初始密码'});return;}
    const cloud=session.accountSnapshot??await loadAccount(),base=readValue('shiwei:guest:sync-base:v1') as AccountSnapshot|null;
    if(epoch!==generation)return;
    const pendingImport=imported??(readValue('shiwei:guest:import-request:v1')===true&&nonempty(guest)?guest:null);
    let next=cloud.value;
    if(pendingImport){next=mergeAccountValues(pendingImport,cloud.value);if(cloud.value.defaults)next.defaults={...cloud.value.defaults,restrictions:next.defaults!.restrictions,...(next.defaults!.aiFoodPreferences?{aiFoodPreferences:next.defaults!.aiFoodPreferences}:{}),...(next.defaults!.healthProfile?{healthProfile:next.defaults!.healthProfile}:{}),...(next.defaults!.aiExcludedFoods?{aiExcludedFoods:next.defaults!.aiExcludedFoods}:{})};}
    else if(base&&!same(value(),base.value))next=reconcile(value(),cloud.value,base.value);
    apply(next);acknowledge(cloud);emit({cloud,local:next,status:'ready',message:''});
    writeValue('shiwei:guest:import-request:v1',false);
    if(!same(next,cloud.value))await syncAccount();
  }catch(error){if(epoch===generation)emit({status:'error',message:(error as Error).message});}
}
export async function syncAccount(retry=true){
  if(writing||state.session?.identity!=='account'||state.session.mustChangePassword||state.status==='review'||!state.cloud)return;
  const local=value();
  const epoch=generation;
  if(same(local,state.cloud.value))return;
  writing=true;emit({status:'saving',message:'正在保存…',local});
  try{
    const saved=await saveAccount(state.cloud.version,local);if(epoch!==generation)return;
    if(same(value(),local)&&!same(saved.value,local))apply(saved.value);
    acknowledge(saved);emit({cloud:saved,status:'ready',message:''});
    if(!same(value(),saved.value))timer=setTimeout(()=>void syncAccount(),100);
  }catch(error){
    if(epoch!==generation)return;
    if(error instanceof ApiError&&error.status===409&&retry){try{const remote=await loadAccount();if(epoch!==generation)return;const next=reconcile(value(),remote.value,state.cloud.value);apply(next);emit({cloud:remote,local:next,status:'ready',message:''});timer=setTimeout(()=>void syncAccount(false),100);}catch{if(epoch===generation)emit({status:'error',message:'暂未保存，本机修改已保留'});}}
    else emit({status:'error',message:(error as Error).message});
  }finally{if(epoch===generation)writing=false;}
}
export async function refreshAccount(){
  if(state.session?.identity!=='account'||state.session.mustChangePassword||writing||state.status==='review')return;
  const epoch=generation;
  try{
    const cloud=await loadAccount();
    if(epoch!==generation)return;
    if(state.cloud?.version===cloud.version)return;
    const next=state.cloud?reconcile(value(),cloud.value,state.cloud.value):cloud.value;
    apply(next);acknowledge(cloud);emit({cloud,local:next,status:'ready',message:''});
    if(!same(next,cloud.value))void syncAccount();
  }catch(error){if(epoch===generation)emit({status:'error',message:(error as Error).message});}
}
export async function confirmAccount(value:AccountValue){
  if(!state.cloud)return;
  const expected=state.cloud.version;
  try{
    const saved=await saveAccount(expected,value);
    apply(saved.value);acknowledge(saved);writeValue('shiwei:guest:import-request:v1',false);
    if(state.guest)writeValue('shiwei:guest:import-handled:v1',state.guest);
    emit({cloud:saved,local:saved.value,guest:null,status:'ready',message:'已同步'});
  }catch(error){emit({status:error instanceof ApiError&&error.status===409?'review':'error',message:(error as Error).message});if(error instanceof ApiError&&error.status===409)emit({cloud:await loadAccount()});}
}
window.addEventListener('shiwei:local-data',event=>{const key=(event as CustomEvent).detail;if(['shiwei:guest:favorites:v1','shiwei:guest:defaults:v1'].includes(key))changed();});
window.addEventListener('focus',()=>void refreshAccount());
window.addEventListener('online',()=>void syncAccount());
window.addEventListener('storage',event=>{if(event.key===storageKey('shiwei:guest:favorites:v1')||event.key===storageKey('shiwei:guest:defaults:v1')){changed();window.dispatchEvent(new Event('shiwei:account-applied'));}});


export function acceptAccountSnapshot(snapshot:AccountSnapshot){
  if(state.session?.identity!=='account')return;
  const next=state.cloud?reconcile(value(),snapshot.value,state.cloud.value):snapshot.value;
  apply(next);acknowledge(snapshot);emit({cloud:snapshot,local:next,status:'ready',message:''});
  if(!same(next,snapshot.value))void syncAccount();
}
// A chat must use the latest accepted/removal settings, including the debounce window.
export async function flushHealthSettings(timeoutMs=5000){
  const epoch=generation,deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){
    if(epoch!==generation)throw Error('登录状态已变化，请重新发送');
    if(state.session?.identity!=='account')return;
    if(state.status==='review')throw Error('请先处理个人设置的同步差异');
    if(!writing){await syncAccount();if(state.status==='error')throw Error('个人设置尚未保存，请稍后再发送');if(state.cloud&&same(value(),state.cloud.value))return;}
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  throw Error('个人设置仍在同步，消息已保留，请稍后发送');
}
export async function saveHealthApiKey(apiKey:string|null){
  if(state.session?.identity!=='account'||!state.cloud)throw Error('请先登录');
  await flushHealthSettings(15000);
  if(state.status==='error'||writing)throw Error('请先完成个人设置同步，再保存Key');
  const epoch=generation;
  try{const snapshot=await updateHealthApiKey(state.cloud!.version,apiKey);if(epoch!==generation)return;acceptAccountSnapshot(snapshot);}
  catch(error){if(error instanceof ApiError&&error.status===409)await refreshAccount();throw error;}
}
