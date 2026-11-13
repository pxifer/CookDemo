import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {createFoodGuidanceProvider} from '../../backend/src/rag/food-guidance';
import {readFoodGuidanceAssets} from '../../backend/src/rag/food-guidance-repository';
import {sourceHashes,sourceFingerprint} from './source-fingerprint';
import {readEvaluationContent,outputHash,type OutputCase} from './recipe-output-evaluation';
import {outputCampaignDirectory} from './output-evaluation-budget';
import type {ChatMessage} from '../../shared/health-chat';
import type {FoodGuidanceProvider} from '../../shared/food-guidance';

export const canonicalHash=(x:unknown):string=>createHash('sha256').update(JSON.stringify(sortJson(x))??'null').digest('hex');
function sortJson(x:any):any{return Array.isArray(x)?x.map(sortJson):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().filter(k=>x[k]!==undefined).map(k=>[k,sortJson(x[k])])):x;}
export function publicOutput(report:any){
 const o=report.observed??{},result=o.result??{},reply=o.reply??{};
 return {message:o.userError?.message??reply.message?.content??result.healthAssessment?.message??o.error??null,
  dishes:(result.dishes??[]).map((d:any)=>({name:d.recipe.name,flavor:d.variant.flavor,reason:d.aiReason??null,basis:d.aiBasis??[]})),
  suggestions:reply.assessment?.suggestions?.map((s:any)=>({foodName:s.foodName,direction:s.direction,reason:s.reason,conditions:s.conditions}))??[]};
}
export function publicError(code:string){return {message:code==='AI_RECIPE_INVALID'?'本次AI搭配未通过本餐条件核对，未返回可用菜品。请保留过敏、忌口和补买限制，核对输入后主动重新搭配；未自动重试。':code.startsWith('HEALTH_UNDERSTANDING')?'这次未能可靠理解你的要求。请核对疾病、目标或本餐限制后重新发送；没有自动重试。':'本次服务请求未完成。请保留原输入和限制，稍后主动重试；没有自动重试。',requiresUserAction:true};}
export function validateHistory(history:unknown):ChatMessage[]{
 if(history===undefined)return [];
 if(!Array.isArray(history)||history.length>12||history.length%2||history.some((m,i)=>!m||Object.keys(m).sort().join(',')!=='content,role'||m.role!==(i%2?'assistant':'user')||typeof m.content!=='string'||!m.content.trim()||m.content.length>4000)||JSON.stringify(history).length>16000)throw Error('OUTPUT_HISTORY_INVALID');
 return history;
}
export async function assertParentHistory(input:OutputCase['input'],loadParent=(id:string)=>readFile(join(outputCampaignDirectory,'runs',id,'report.json'),'utf8').then(JSON.parse)){
 const history=validateHistory(input.history);if(!history.length){if(input.parentRunId)throw Error('OUTPUT_PARENT_WITHOUT_HISTORY');return;}
 if(!input.parentRunId||!/^[-\w.]+$/.test(input.parentRunId))throw Error('OUTPUT_HISTORY_PARENT_REQUIRED');
 const parent=await loadParent(input.parentRunId);
 const answer=parent.observed?.reply?.message?.content;
 if(!answer||!parent.input?.userText||canonicalHash(history)!==canonicalHash([...(parent.input.history??[]),{role:'user',content:parent.input.userText},{role:'assistant',content:answer}]))throw Error('OUTPUT_HISTORY_NOT_OBSERVED');
}
export async function evaluationGuidance(){
 const assets=await readFoodGuidanceAssets(),base=createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set());
 const expansion=(assets as any).expansion;
 if(!expansion)return {assets,provider:base,expansion:null};
 // The separately reviewed nutrition commit adds this module. Do not copy another
 // checkout's candidate into the running project or silently discard loaded data.
 const module=await import(new URL('../../backend/src/rag/nutrition-guidance-provider.ts',import.meta.url).href);
 const provider:FoodGuidanceProvider=module.createNutritionGuidanceProvider(base,expansion,async()=>new Set());
 if(!provider?.prepare||!provider?.assertCurrent)throw Error('OUTPUT_EXPANSION_PROVIDER_INVALID');
 return {assets,provider,expansion:{id:expansion.id,sha256:outputHash(expansion),newVectors:false,clinicalSignoff:false}};
}
export async function runtimeIdentity(){
 const {assets,expansion}=await evaluationGuidance(),catalog=await readEvaluationContent();
 const optionalFile=async(path:string)=>readFile(path).then(bytes=>({path,sha256:createHash('sha256').update(bytes).digest('hex')}),(e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return null;throw e;});
 return {sourceFingerprint:sourceFingerprint(await sourceHashes()),pipeline:'structured-food-guidance-and-recipe-selection',knowledge:{base:assets.bundle.id,baseHash:outputHash(assets.bundle),goals:assets.goals.id,goalsHash:outputHash(assets.goals),mapping:assets.mappings.id,mappingHash:outputHash(assets.mappings),expansion,topicExplanation:await optionalFile('datasets/health/thyroid-iodine-explanation-2026-11-13-v1/knowledge.json')},catalog:{version:catalog.content.contentVersion,sha256:catalog.sha256},model:'deepseek-flash',userQuantityPolicy:'presence-only'};
}
export function assertRoundIdentity(expected:unknown,actual:unknown){if(canonicalHash(expected)!==canonicalHash(actual))throw Error('OUTPUT_ROUND_VERSION_CHANGED_PREPARE_NEW_ROUND');}
export function roundPath(name:string){if(!/^[a-zA-Z0-9][\w-]{0,79}$/.test(name))throw Error('OUTPUT_ROUND_NAME_INVALID');return resolve(outputCampaignDirectory,'rounds',name);}
export async function writeOnce(file:string,value:unknown){await mkdir(resolve(file,'..'),{recursive:true});await writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
export function assertPrivateOutput(path:string){const p=resolve(path);if(!p.startsWith(resolve('.local-data')+sep))throw Error('OUTPUT_PRIVATE_PATH_REQUIRED');return p;}
