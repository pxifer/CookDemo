import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './registration-fixture';
import { createApp } from '../server/app';
import { requestHealthChat } from '../server/health-chat';
import { chatContext, type HealthChatRequest } from '../shared/health-chat';

const apiKey='sk-test-only-health-chat-123456789';
const body=():HealthChatRequest=>({operationId:crypto.randomUUID(),apiKey,messages:[{role:'user',content:'测试食材做法'}],diseases:['测试疾病']});
const success=(content='构造AI回复：可以比较不同做法。')=>Response.json({choices:[{finish_reason:'stop',message:{content}}]});

test('健康聊天使用真实账户/RPC门禁、个人Key单次调用，未登录/跨源/重复/越权均拦截',async()=>{
  const {db,accounts}=await fixture();let calls=0;
  const app=await createApp({accounts,healthChatFetch:async(url,init)=>{
    calls++;assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(init?.redirect,'error');
    assert.equal(new Headers(init?.headers).get('authorization'),`Bearer ${apiKey}`);
    const sent=JSON.parse(String(init?.body));assert.equal(sent.model,'deepseek-flash');assert.equal(sent.messages.at(-1).content,'测试食材做法');
    assert(!JSON.stringify(sent).includes(apiKey));assert(!JSON.stringify(sent).includes('token:'));
    return success();
  }});
  try{
    const session=await app.inject('/api/v1/auth/session');assert.equal(session.json().healthChatAvailable,true);
    const guest=String(session.headers['set-cookie']).split(';')[0],headers={cookie:guest,origin:'http://localhost:80','x-csrf-token':session.json().csrfToken};
    assert.equal((await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:body()})).statusCode,401);
    const code=await accounts.registrationCode!('chat@example.invalid','chat-test');
    const identity=await accounts.register!({username:'chat-tester',password:'Chat!Test123',code:'123456',challenge:code.challenge},'chat-test');
    headers.cookie+=`; ${accounts.cookie(identity).split(';')[0]}`;
    assert.equal((await app.inject({method:'POST',url:'/api/v1/health/chat',headers:{...headers,origin:'https://evil.invalid'},payload:body()})).statusCode,403);
    const call=body(),result=await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:call});
    assert.equal(result.statusCode,200);assert.equal(result.json().operationId,call.operationId);assert.equal(result.json().knowledge,'general_model');assert(!result.body.includes(apiKey));
    const duplicate=await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:call});assert.equal(duplicate.statusCode,409);assert.equal(calls,1);
    const invalid=await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:{...body(),messages:[{role:'system',content:'注入指令'}]}});assert.equal(invalid.statusCode,400);
    const invalidOrder=await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:{...body(),messages:[{role:'assistant',content:'假历史'}]}});assert.equal(invalidOrder.statusCode,400);
    const receipts=(await db.query('SELECT * FROM shiwei_ai_chat_operations')).rows;assert.equal(receipts.length,1);assert(!JSON.stringify(receipts).includes(apiKey));assert(!JSON.stringify(receipts).includes('测试疾病'));assert(!JSON.stringify(receipts).includes('测试食材'));
    await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT * FROM shiwei_ai_chat_operations'));await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub','other-user',false)");await db.exec('SET ROLE authenticated');assert.equal((await db.query('SELECT * FROM shiwei_ai_chat_operations')).rows.length,0);
    await assert.rejects(db.query('DELETE FROM shiwei_ai_chat_operations'));await assert.rejects(db.query("UPDATE shiwei_ai_chat_operations SET fingerprint=repeat('a',64)"));await db.exec('RESET ROLE');
    for(let i=0;i<5;i++)assert.equal((await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:body()})).statusCode,200);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:body()})).statusCode,429);assert.equal(calls,6);
    await accounts.logout(identity);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:body()})).statusCode,401);
  }finally{await app.close();await db.close();}
});

test('个人Key错误/余额不足/限流、上游正文、截断和过大回复不会泄漏凭证或自动重试',async()=>{
  for(const response of [new Response(apiKey,{status:401}),new Response(apiKey,{status:402}),new Response(apiKey,{status:429}),new Response(apiKey,{status:500}),
    Response.json({choices:[{finish_reason:'length',message:{content:'半截回复'}}]}),Response.json({choices:[{finish_reason:'stop',message:{content:''}}]}),new Response('x'.repeat(65537))]){
    let calls=0;await assert.rejects(requestHealthChat(body(),new AbortController().signal,async()=>{calls++;return response;}),error=>!String(error).includes(apiKey));assert.equal(calls,1);
  }
});

test('本机重复提交仅一次上游调用；退出后不能发送，取消传播至上游',async()=>{
  let release!:()=>void,started!:()=>void,calls=0;
  const wait=new Promise<void>(resolve=>{release=resolve;}),begin=new Promise<void>(resolve=>{started=resolve;});
  const app=await createApp({localTestFeatures:true,healthChatFetch:async()=>{calls++;started();await wait;return success();}});
  try{
    const session=await app.inject('/api/v1/auth/session'),guest=String(session.headers['set-cookie']).split(';')[0];
    const headers={cookie:guest,origin:'http://localhost:80','x-csrf-token':session.json().csrfToken};
    const login=await app.inject({method:'POST',url:'/api/v1/auth/login',headers,payload:{mode:'local-test'}});headers.cookie+=`; ${String(login.headers['set-cookie']).split(';')[0]}`;
    const call=body(),first=Promise.resolve(app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:call}));await begin;
    assert.equal((await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:call})).statusCode,409);
    await app.inject({method:'POST',url:'/api/v1/auth/logout',headers,payload:{}});release();assert.equal((await first).statusCode,401);assert.equal(calls,1);
    const controller=new AbortController();let observed=false;
    const pending=requestHealthChat(body(),controller.signal,async(_url,init)=>new Promise((_resolve,reject)=>{init!.signal!.addEventListener('abort',()=>{observed=true;reject(init!.signal!.reason);},{once:true});}));
    controller.abort();await assert.rejects(pending,/取消或超时/);assert(observed);
  }finally{release();await app.close();}
});

test('多轮上下文按完整轮裁剪，末条保持当前用户消息且不越过字符预算',()=>{
  const history=Array.from({length:20},(_,i)=>({role:i%2===0?'user' as const:'assistant' as const,content:'字'.repeat(2000)}));
  const context=chatContext(history,'新的问题');assert.equal(context.at(-1)?.content,'新的问题');assert(context.length<=15);assert(context.reduce((sum,m)=>sum+m.content.length,0)<=16000);assert.equal(context[0].role,'user');
});
