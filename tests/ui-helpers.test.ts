import test from 'node:test';
import assert from 'node:assert/strict';
import type {Page,Route} from '@playwright/test';
import {recommendationAfter} from './ui-helpers';
function harness(failure=false,error?:{code:string;message:string}){
  let handler:((route:Route)=>Promise<void>)|undefined;
  const state={fetches:0,reads:0,disposed:0,aborts:0,body:'',removed:false};
  const expected={status:'completed',dishes:[]};
  const body=JSON.stringify({type:'progress',stage:'构造进度'})+'\n'+JSON.stringify(error?{type:'error',...error}:{type:'result',result:expected})+'\n';
  const route={request:()=>({method:()=> 'POST',postDataJSON:()=>({action:'variant'})}),fetch:async(options:unknown)=>{
    state.fetches++;assert.deepEqual(options,{maxRedirects:0,maxRetries:0});if(failure)throw Error('constructed transport failure');
    return {ok:()=>true,text:async()=>{state.reads++;return body;},dispose:async()=>{state.disposed++;}};
  },fulfill:async(options:{body:string})=>{state.body=options.body;},abort:async()=>{state.aborts++;}} as unknown as Route;
  const page={route:async(_pattern:string,next:typeof handler)=>{handler=next;},unroute:async(_pattern:string,previous:typeof handler)=>{assert.equal(previous,handler);state.removed=true;},waitForResponse:()=>{throw Error('Browser CDP response bodies must not be read');}} as unknown as Page;
  return {page,state,expected,body,action:async()=>{assert(handler);await handler(route);}};
}
test('浏览器契约捕获从真实转发接口读取一次完整NDJSON，不依赖已消费的CDP正文',async()=>{
  const f=harness(),result=await recommendationAfter(f.page,f.action,'variant');
  assert.deepEqual(result,f.expected);assert.equal(f.state.fetches,1);assert.equal(f.state.reads,1);assert.equal(f.state.body,f.body);assert.equal(f.state.disposed,1);assert.equal(f.state.removed,true);assert.equal(f.state.aborts,0);
});
test('捕获网络故障不重发，并清理路由与定时器',async()=>{
  const f=harness(true);await assert.rejects(recommendationAfter(f.page,f.action,'variant'),/constructed transport failure/);
  assert.equal(f.state.fetches,1);assert.equal(f.state.reads,0);assert.equal(f.state.aborts,1);assert.equal(f.state.removed,true);
});
test('服务端错误终态保留具体错误码和说明，不能冒充成功或只显示缺少结果',async()=>{
  const f=harness(false,{code:'CURSOR_EXPIRED',message:'构造游标错误'});
  await assert.rejects(recommendationAfter(f.page,f.action,'variant'),/Recommendation failed: CURSOR_EXPIRED: 构造游标错误/);
  assert.equal(f.state.fetches,1);assert.equal(f.state.body,f.body);assert.equal(f.state.disposed,1);assert.equal(f.state.removed,true);
});
