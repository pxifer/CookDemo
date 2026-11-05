import { mkdir,open,readFile,unlink } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { EvaluationBudget,type VerifiedPricing } from './evaluation-budget';
export async function openEvaluationBudget(pricingPath:string,ledgerPath=resolve('.local-data/evaluation/budget-cny5-v1.jsonl')){
  const pricing:VerifiedPricing=JSON.parse(await readFile(pricingPath,'utf8'));
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const budget=new EvaluationBudget(5,pricing,today),path=resolve(ledgerPath);await mkdir(dirname(path),{recursive:true});
  const lock=await open(path+'.lock','wx',0o600);
  try{
    let text='';try{text=await readFile(path,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    if(text&&!text.endsWith('\n'))throw Error('EVALUATION_BUDGET_LEDGER_TRUNCATED');
    const records=text.trim()?text.trim().split('\n').map(line=>JSON.parse(line) as {reservedMicroCny:number}):[];
    if(records.some(row=>!Number.isSafeInteger(row.reservedMicroCny)||row.reservedMicroCny<0))throw Error('EVALUATION_BUDGET_LEDGER_INVALID');
    budget.restoreReserved(records.reduce((sum,row)=>sum+row.reservedMicroCny,0));
    const file=await open(path,'a',0o600);
    return {reserve:async(body:string,outputTokens:number)=>{
      const amount=budget.reserve(Buffer.byteLength(body),outputTokens);
      await file.writeFile(JSON.stringify({at:new Date().toISOString(),model:pricing.model,reservedMicroCny:amount,note:'Conservative reservation; failures and unknown usage are not refunded automatically'})+'\n');await file.sync();return amount;
    },reservedMicroCny:()=>budget.reservedMicroCny,close:async()=>{await file.close();await lock.close();await unlink(path+'.lock');}};
  }catch(error){await lock.close();await unlink(path+'.lock');throw error;}
}
