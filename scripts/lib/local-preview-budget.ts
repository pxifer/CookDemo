import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {DomainError} from '../../backend/src/recommendation';

/** Single-process local preview only. No credentials/headers are written to disk. */
export function localPreviewBudget(fetcher:typeof fetch=fetch,directory='.local-data/rag-preview'){
  const root=resolve(directory);if(!root.startsWith(resolve('.local-data')+'\\')&&!root.startsWith(resolve('.local-data')+'/'))throw Error('PRIVATE_PREVIEW_DIRECTORY_REQUIRED');
  mkdirSync(root,{recursive:true});const file=join(root,'budget-20261105-cny1.json');
  if(!existsSync(file)&&readdirSync(root).some(name=>/^call-\d+\.json$/.test(name)))throw Error('PREVIEW_LEDGER_MISSING_RECOVERY_REQUIRED');
  const state=existsSync(file)?JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,'')):{authorization:'2026-11-05 UI-saved key; user authorizes agent calls up to CNY1',ceilingCny:1,maxAttempts:20,attempts:[],pricing:{inputPerMillionCny:2,outputPerMillionCny:8,checked:'2026-11-05',source:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/'}};
  if(state.ceilingCny!==1||!Array.isArray(state.attempts)||state.closed)throw Error('PREVIEW_AUTHORIZATION_INVALID_OR_CLOSED');
  if(state.attempts.some((a:any)=>!Number.isFinite(a.reservedCny)||a.reservedCny<=0)||state.attempts.reduce((n:number,a:any)=>n+a.reservedCny,0)>1)throw Error('PREVIEW_LEDGER_INVALID');
  // The user set a monetary limit, not a call count. Preserve all prior reservations.
  state.maxAttempts=20;const save=()=>writeFileSync(file,JSON.stringify(state,null,2)+'\n');save();
  const bounded:typeof fetch=async(input,init)=>{
    if(String(input)!=='https://api.deepseek.com/chat/completions')throw Error('PREVIEW_MODEL_DESTINATION_REJECTED');
    const request=JSON.parse(String(init?.body));
    if(request.model!=='deepseek-flash'||request.stream!==false||!Number.isInteger(request.max_tokens)||request.max_tokens>2400||request.max_tokens<1)throw Error('PREVIEW_MODEL_PARAMETERS_REJECTED');
    const reserve=((Buffer.byteLength(JSON.stringify(request.messages),'utf8')+10000)*2+request.max_tokens*8)/1_000_000;
    if(state.attempts.length>=state.maxAttempts||state.attempts.reduce((n:number,a:any)=>n+a.reservedCny,0)+reserve>1)throw new DomainError('PREVIEW_BUDGET_EXHAUSTED',429,'本轮1元预算预留已达上限，未发送新请求。');
    const record:any={number:state.attempts.length+1,started:new Date().toISOString(),reservedCny:reserve,status:'reserved'};
    state.attempts.push(record);save(); // Reserve before fetch; failed/unknown calls retain the reservation.
    const trace:any={kind:'real_supplier_request',request,record};const traceFile=join(root,`call-${record.number}.json`);
    const saveTrace=()=>writeFileSync(traceFile,JSON.stringify(trace,null,2)+'\n');saveTrace();
    try{
      const response=await fetcher(input,init);record.httpStatus=response.status;
      if(response.ok){
        const raw=await response.clone().text();if(Buffer.byteLength(raw)>65536)throw Error('PREVIEW_CAPTURE_TOO_LARGE');
        trace.response=JSON.parse(raw);const usage=trace.response.usage;
        if(usage&&Number.isFinite(usage.prompt_tokens)&&Number.isFinite(usage.completion_tokens))record.peakCostUpperCny=(usage.prompt_tokens*2+usage.completion_tokens*8)/1_000_000;
        record.status='response_received';record.requestId=trace.response.id;record.model=trace.response.model;
      }else record.status='provider_error';
      record.finished=new Date().toISOString();save();saveTrace();return response;
    }catch(error){record.status='failed_or_unknown_consumption';record.finished=new Date().toISOString();save();saveTrace();throw error;}
  };
  return {fetch:bounded,snapshot:()=>structuredClone(state)};
}
