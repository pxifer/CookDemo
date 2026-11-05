import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {localPreviewBudget} from '../scripts/lib/local-preview-budget';
const root=resolve('.local-data');mkdirSync(root,{recursive:true});
async function isolated(run:(dir:string)=>Promise<void>){const dir=mkdtempSync(join(root,'preview-budget-test-'));try{await run(dir);}finally{if(!dir.startsWith(root+sep)||!dir.includes('preview-budget-test-'))throw Error('BAD_TEST_DIRECTORY');rmSync(dir,{recursive:true});}}
const request=(content='public example')=>({method:'POST',headers:{Authorization:'Bearer sk-sensitive-fixture-never-persist'},body:JSON.stringify({model:'deepseek-flash',stream:false,max_tokens:2400,messages:[{role:'user',content}]})});
const url='https://api.deepseek.com/chat/completions';

test('本地真实预览：先预留后请求、记录真实usage；不保存headers/Key，重新打开不重置账本',async()=>isolated(async dir=>{
 let calls=0;const b=localPreviewBudget(async()=>{calls++;return Response.json({id:'real-receipt-fixture',model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120}});},dir);
 await b.fetch(url,request());assert.equal(calls,1);assert.equal(b.snapshot().attempts[0].peakCostUpperCny,.00036);
 for(const name of readdirSync(dir))assert(!readFileSync(join(dir,name),'utf8').includes('sk-sensitive-fixture'));
 assert.equal(localPreviewBudget(async()=>{throw Error('not called');},dir).snapshot().attempts.length,1);
}));

test('失败和未知消耗保留预算；并发请求不能超过1元预留，超额不发请求、不重试',async()=>isolated(async dir=>{
 let calls=0;const b=localPreviewBudget(async()=>{calls++;throw Error('synthetic network failure');},dir);
 const results=await Promise.allSettled(Array.from({length:3},()=>b.fetch(url,request('x'.repeat(180000)))));
 assert(results.every(r=>r.status==='rejected'));assert.equal(calls,2);assert.equal(b.snapshot().attempts.length,2);assert(b.snapshot().attempts.every((r:any)=>r.status==='failed_or_unknown_consumption'));assert(b.snapshot().attempts.reduce((n:number,r:any)=>n+r.reservedCny,0)<=1);
}));

test('拒绝非固定地址、错误模型和过量输出；未发请求也不认领调用次数',async()=>isolated(async dir=>{
 let calls=0;const b=localPreviewBudget(async()=>{calls++;throw Error('not called');},dir);
 await assert.rejects(b.fetch('https://example.invalid',request()),/DESTINATION/);
 await assert.rejects(b.fetch(url,{...request(),body:JSON.stringify({model:'other',max_tokens:2400,stream:false})}),/PARAMETERS/);
 await assert.rejects(b.fetch(url,{...request(),body:JSON.stringify({model:'deepseek-flash',max_tokens:3000,stream:false})}),/PARAMETERS/);
 assert.equal(calls,0);assert.equal(b.snapshot().attempts.length,0);
}));
