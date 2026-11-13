import {canonicalKnowledgeHash,validateKnowledgeBundle} from '../health-knowledge';
import {searchNutritionKnowledge,validateNutritionExpansion} from './nutrition-knowledge';
import {createFoodGuidanceProvider,guidanceProfile,type GoalKnowledge,type GuidanceMappings} from './food-guidance';
import {createNutritionGuidanceProvider} from './nutrition-guidance-provider';
import type {FoodGuidanceProvider} from '../../../shared/food-guidance';
import type {KnowledgeBundle} from '../../../shared/health-knowledge';
import type {NutritionExpansion} from '../../../shared/nutrition-knowledge';
export interface PublishedKnowledge {bundle:KnowledgeBundle;goals:GoalKnowledge;mappings:GuidanceMappings;expansion:NutritionExpansion}
/** Public facts only. Credentials, profiles and queries never enter this repository. */
export function createCloudKnowledge(options:{envId:string;key:string;releaseId:string;hash:string;fetch?:typeof fetch}):FoodGuidanceProvider{
 if(!/^shiwei-[a-z0-9-]+$/.test(options.envId)||!/^knowledge-[a-z0-9-]{1,65}$/.test(options.releaseId)||!/^[a-f0-9]{64}$/.test(options.hash)||!options.key)throw Error('KNOWLEDGE_CONFIGURATION');
 let assets:PublishedKnowledge|undefined;
 const read=async(payload=false)=>{
  const url=`https://${options.envId}.api.tcloudbasegateway.com/v1/rdb/rest/shiwei_knowledge_releases?release_id=eq.${options.releaseId}&published=eq.true&select=checksum,revocations${payload?',payload':''}`;
  const response=await(options.fetch??fetch)(url,{headers:{Authorization:`Bearer ${options.key}`},signal:AbortSignal.timeout(5000),redirect:'error'});
  if(!response.ok)throw Error('KNOWLEDGE_UNAVAILABLE');
  const raw=await response.text();if(Buffer.byteLength(raw)>8*1024*1024)throw Error('KNOWLEDGE_TOO_LARGE');
  const rows=JSON.parse(raw),row=rows?.[0];
  if(!Array.isArray(rows)||rows.length!==1||row.checksum!==options.hash||!Array.isArray(row.revocations)||row.revocations.length>10000||row.revocations.some((x:unknown)=>typeof x!=='string'||x.length>300))throw Error('KNOWLEDGE_WITHDRAWN_OR_CHANGED');
  if(payload){
   if(canonicalKnowledgeHash(row.payload)!==options.hash)throw Error('KNOWLEDGE_INTEGRITY');
   const a=row.payload as PublishedKnowledge;validateKnowledgeBundle(a.bundle);validateNutritionExpansion(a.expansion);
   if(!a.goals?.facts?.length||!a.mappings?.objects||!a.goals.evidence?.length)throw Error('KNOWLEDGE_ASSETS');assets=a;
  }
  return new Set<string>(row.revocations);
 };
 let loading:Promise<void>|undefined;
 const load=async()=>{if(!assets){loading??=read(true).then(()=>{}).catch(e=>{loading=undefined;throw e;});await loading;}return assets!;};
 const provider=async()=>{const a=await load();return createNutritionGuidanceProvider(createFoodGuidanceProvider(a.bundle,a.goals,a.mappings,read),a.expansion,read);};
 // One composite provider per immutable release; assertCurrent re-reads cloud withdrawal state.
 let instance:Promise<FoodGuidanceProvider>|undefined; const get=()=>instance??=provider().catch(e=>{instance=undefined;throw e;});
 return {async prepare(input){const a=await load(),p=await get();const profile=guidanceProfile(input.profile,input.currentText??'',a.bundle,a.goals);const packet=await p.prepare({...input,profile});const text=input.currentText??'';let nutritionReference:Record<string,unknown>|undefined;
 if(text&&text.length<=1000&&/维生素|矿物质|热量|能量|蛋白质|脂肪|碳水|含钙|含铁|含锌|营养/.test(text)){const result=searchNutritionKnowledge(a.expansion,text,{limit:2,revoked:await read()});nutritionReference={version:result.knowledgeVersion,scope:result.lookupScope,interpretation:result.interpretation,nutrients:result.nutrients,foods:result.foods.map(f=>({...f,values:f.values.map(({sourceRow,...v})=>v)})),sources:result.sources.map(({id,title,url,version,sourceHash,reviewDue})=>({id,title,url,version,sourceHash,reviewDue}))};}
 return {...packet,mode:'source_guidance',...(nutritionReference?{nutritionReference}:{})};},async assertCurrent(packet){const a=await load(),revoked=new Set([...a.bundle.revocations,...await read()]);await(await get()).assertCurrent(packet,revoked);}};
}
