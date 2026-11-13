import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {openEvaluationBudget} from './evaluation-budget-ledger';

export const outputCampaign='output-evaluation-20261113-cny5';
export const outputCampaignDirectory=resolve('.local-data/evaluation',outputCampaign);
const pricing={model:'deepseek-flash',currency:'CNY',inputPerMillion:2,outputPerMillion:8,verifiedDate:'2026-11-13',source:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/'};
const authorization={id:outputCampaign,authorizedDate:'2026-11-13',maximumCny:5,maximumAttempts:32,allowedModel:'deepseek-flash',allowedEndpoint:'https://api.deepseek.com/chat/completions',scope:'User-authorized new CNY5 output evaluation; synthetic public cases only; no automatic retry, no deployment; previous budgets stay closed.'};
export const simulationExecutionPolicy={id:'simulated-user-phase-20261113-v1',campaign:outputCampaign,maximumCny:5,maximumAttempts:64,previousMaximumAttempts:32,reason:'2026-11-13 user requested more simulated-user evaluations and adaptation to knowledge changes; internal attempt guard extended, original cumulative money ceiling and ledger unchanged.',automaticRetry:false};
export function validateSimulationPolicy(value:unknown){if(JSON.stringify(value)!==JSON.stringify(simulationExecutionPolicy))throw Error('OUTPUT_EXECUTION_POLICY_INVALID');return simulationExecutionPolicy;}
export async function outputExecutionPolicy(root=outputCampaignDirectory){
 const raw=await readFile(join(root,'simulation-execution-policy.json'),'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 return raw?validateSimulationPolicy(JSON.parse(raw)):{id:'original-32-attempts',maximumCny:5,maximumAttempts:32};
}
export async function initializeOutputCampaign(directory=outputCampaignDirectory){
 const root=resolve(directory);if(!root.startsWith(resolve('.local-data')+sep))throw Error('OUTPUT_PRIVATE_DIRECTORY_REQUIRED');
 await mkdir(root,{recursive:true});
 for(const [name,value] of [['authorization.json',authorization],['pricing.json',pricing]] as const){
  const raw=JSON.stringify(value,null,2)+'\n',file=join(root,name);
  try{await writeFile(file,raw,{flag:'wx',mode:0o600});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST'||await readFile(file,'utf8')!==raw)throw Error('OUTPUT_AUTHORIZATION_CHANGED_OR_CLOSED');}
 }
 return root;
}
export async function openOutputLiveFetch(directory=outputCampaignDirectory,fetcher:typeof fetch=fetch){
 const root=await initializeOutputCampaign(directory);
 if(await readFile(join(root,'closed.json'),'utf8').then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}))throw Error('OUTPUT_AUTHORIZATION_CLOSED');
 const policy=await outputExecutionPolicy(root);
 const budget=await openEvaluationBudget(join(root,'pricing.json'),join(root,'budget.jsonl'));
 const traces=join(root,'calls');await mkdir(traces,{recursive:true});
 let attemptCount=(await readdir(traces)).filter(n=>/^call-\d+\.json$/.test(n)).length,sent=0;
 const bounded:typeof fetch=async(input,init)=>{
  if(String(input)!==authorization.allowedEndpoint||init?.redirect!=='error')throw Error('OUTPUT_PROVIDER_DESTINATION_REJECTED');
  const body=String(init?.body),request=JSON.parse(body);
  // Existing general chat uses 4000; recipe selection 2400; input understanding 800.
  if(request.model!=='deepseek-flash'||request.stream!==false||!Number.isInteger(request.max_tokens)||request.max_tokens<1||request.max_tokens>4000||Buffer.byteLength(body)>256000||attemptCount>=policy.maximumAttempts)throw Error('OUTPUT_PROVIDER_PARAMETERS_REJECTED');
  const reserved=await budget.reserve(body,request.max_tokens); // Durable before network; failures never auto-refund.
  const number=++attemptCount,file=join(traces,`call-${number}.json`);
  const record:any={number,startedAt:new Date().toISOString(),status:'reserved',reservedMicroCny:reserved,executionPolicy:policy.id,request};
  const save=()=>writeFile(file,JSON.stringify(record,null,2)+'\n',{mode:0o600});await save();
  try{
   sent++;const response=await fetcher(input,init);record.httpStatus=response.status;
   if(response.ok){
    const raw=await response.clone().text();if(Buffer.byteLength(raw)>65536)throw Error('OUTPUT_RECEIPT_TOO_LARGE');
    record.response=JSON.parse(raw);const usage=record.response.usage;
    if(usage&&[usage.prompt_tokens,usage.completion_tokens].every(v=>Number.isSafeInteger(v)&&v>=0))record.receiptCostUpperCny=(usage.prompt_tokens*2+usage.completion_tokens*8)/1e6;
    record.status='response_received';
   }else record.status='provider_error';
   record.finishedAt=new Date().toISOString();await save();return response;
  }catch(error){record.status='failed_or_unknown_consumption';record.finishedAt=new Date().toISOString();await save();throw error;}
 };
 return {fetch:bounded,networkAttempts:()=>sent,reservedMicroCny:()=>budget.reservedMicroCny(),close:()=>budget.close()};
}
