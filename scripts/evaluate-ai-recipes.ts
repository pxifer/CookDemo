import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { randomBytes,createHash } from 'node:crypto';
import { createHealthRecipeSelector,type SelectionDiagnostics } from '../backend/src/health-recipe-selection';
import { contentContext,type ContentSnapshot } from '../shared/content';
import { extractText } from '../shared/extraction';
import { defaultMeal,type Meal } from '../shared/types';
import { openEvaluationBudget } from './lib/evaluation-budget-ledger';

async function main(){
const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const dataset=await read('datasets/evaluation/recipe-tasks-v1.json');
const content:ContentSnapshot=await read('datasets/health/recipe-research/recipe-snapshot.json'),context=contentContext(content);
const live=process.argv.includes('--live');
if(live&&process.env.SHIWEI_LOCAL_TEST_ONLY==='1')throw Error('LIVE_EVALUATION_DISABLED_FOR_LOCAL_TESTS');
// No fallback to application secrets, account keys, .env files or platform keys.
const key=live?(process.env.SHIWEI_EVALUATION_KEY_FILE?(await readFile(process.env.SHIWEI_EVALUATION_KEY_FILE,'utf8')).trim():process.env.SHIWEI_EVALUATION_KEY):'sk-evaluation-synthetic-only-123456789';
if(live&&(process.env.EVALUATION_ALLOW_PAID!=='1'||!/^sk-[A-Za-z0-9_-]{16,250}$/.test(key??'')))throw Error('LIVE_EVALUATION_REQUIRES_DEDICATED_AUTHORIZED_KEY_AND_EXPLICIT_PAID_FLAG');
if(live&&!process.env.SHIWEI_EVALUATION_PRICING_FILE)throw Error('LIVE_EVALUATION_REQUIRES_VERIFIED_PRICING_FILE');
const budget=live?await openEvaluationBudget(process.env.SHIWEI_EVALUATION_PRICING_FILE!):undefined;
const selector=createHealthRecipeSelector(randomBytes(32));
const rows=[];
try{
for(const task of dataset.tasks){
  const parsed=extractText(task.ingredients,context),meal:Meal={...defaultMeal(),ingredients:parsed.ingredients.map(i=>({...i,status:'confirmed'})),allowBuy:true,health:true,composition:'custom',counts:{meat:0,veg:0,soup:1},healthProfile:{conditions:[],goals:[],notes:task.notes,suggestions:[],updatedAt:'2026-10-29'}};
  if(task.restriction)meal.restrictions=[{id:task.id,kind:'allergy',name:task.restriction,targets:context.restrictionTargets(task.restriction),status:'confirmed',scope:'self',original:'构造限制'}];
  const diagnostics:SelectionDiagnostics[]=[];let attempts=0;
  const fetcher:typeof fetch=async(url,init)=>{
    if(live){const body=String(init?.body),packet=JSON.parse(body);await budget!.reserve(body,packet.max_tokens);attempts++;return fetch(url,init);}
    attempts++;
    const packet=JSON.parse(JSON.parse(String(init?.body)).messages.at(-1).content);
    return Response.json({id:`synthetic-evaluation-${task.id}`,model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:50,total_tokens:150},choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'构造契约答复，不作为模型质量证据',choices:packet.catalog.slice(0,packet.count).map((c:{id:string})=>({id:c.id,reason:'构造选择：使用目录中实际配料与做法。'}))})}}]});
  };
  let result,code:string|null=null;const start=performance.now();
  try{result=await selector({request:{operationId:crypto.randomUUID(),meal,action:'generate',selected:[],previous:[],page:0},owner:'synthetic-evaluation',apiKey:key!,context,signal:AbortSignal.timeout(20000),fetcher,present:d=>d,claim:async()=>{},progress:()=>{},observe:d=>diagnostics.push(d)});}catch(error){code=typeof (error as {code?:string}).code==='string'?(error as {code:string}).code:'UNCLASSIFIED';}
  const success=task.expect==='no_call'?attempts===0&&result?.status==='no_results':task.expect==='selected'?result?.status==='completed':Boolean(result&&['completed','no_results','unavailable'].includes(result.status));
  rows.push({id:task.id,expect:task.expect,contractPassed:success,status:result?.status??'error',errorCode:code,attempts,elapsedMs:Math.round(performance.now()-start),diagnostics,selectionScope:result?.selectionScope,selected:result?.dishes.map(d=>({recipeId:d.recipe.id,variantId:d.variant.id,reason:d.aiReason})),humanQualityReview:{state:'pending',checks:task.humanChecks??['理由是否被配方支持','是否过度医疗承诺','是否回应构造目标']}});
}
const latencies=rows.filter(r=>r.attempts).map(r=>r.elapsedMs).sort((a,b)=>a-b),usage=rows.flatMap(r=>r.diagnostics).reduce((sum,d)=>sum+d.invocation.totalTokens,0);
const report={dataset:dataset.id,datasetHash:createHash('sha256').update(JSON.stringify(dataset)).digest('hex'),mode:live?'real_provider_public_synthetic_tasks':'mock_contract_only',contentVersion:content.contentVersion,independentReview:null,rows,contractPassed:rows.filter(r=>r.contractPassed).length,total:rows.length,knownTotalTokens:live?usage:null,syntheticTotalTokens:live?null:usage,unknownUsageAttempts:rows.reduce((sum,r)=>sum+r.attempts-r.diagnostics.length,0),p50ms:latencies[Math.floor(latencies.length*.5)]??null,p95ms:latencies[Math.floor(latencies.length*.95)]??null,monetaryCost:null,budgetCny:5,reservedMicroCny:budget?.reservedMicroCny()??0,qualityPassed:null,note:'单次任务最多一次供应商调用；失败不重试。预留按UTF-8字节及协议余量保守估算，不是账户级硬限额；失败不自动退还预留。契约通过不代表模型质量通过。'};
const out=resolve(process.env.AI_EVALUATION_DIR??`artifacts/acceptance/ai-evaluation-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(out,{recursive:true});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({mode:report.mode,total:report.total,contractPassed:report.contractPassed,qualityPassed:null,report:join(out,'report.json')}));
if(report.contractPassed!==report.total)process.exitCode=1;
}finally{await budget?.close();}

}
main().catch(error=>{console.error(/^(?:EVALUATION|LIVE_EVALUATION)_[A-Z_]+$/.test(error?.message)?error.message:'AI_EVALUATION_FAILED');process.exitCode=1;});
