import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePantryFood,suggestPantryFoods} from '../shared/ingredient-matching';
import {constructedContent} from '../shared/catalog';
import {requestHealthChat} from '../backend/src/health-chat';
import {fixture} from './registration-fixture';
import {createApp} from '../backend/src/app';
import {makeRestriction} from '../shared/extraction';
import {defaultMeal} from '../shared/types';

test('同义词自动匹配，生肉/干果不猜种类，给出明确选择',()=>{
 const lookup=new Map(constructedContent.foodById);
 const tomato={...lookup.get('tomato')!,id:'cherry-test',name:'圣女果',aliases:[]};lookup.set(tomato.id,tomato);
 assert.equal(resolvePantryFood('小西红柿',lookup)?.id,'cherry-test');
 assert.equal(resolvePantryFood('生肉',lookup),undefined);
 assert(suggestPantryFoods('生肉',lookup).some(f=>f.name==='牛肉'));
 assert.equal(resolvePantryFood('干果',lookup),undefined);
 assert.equal(resolvePantryFood('花生油',lookup)?.id===lookup.get('peanut')?.id,false);
});
const receipt=(profile:unknown,reply='按已有目标继续给出食材参考。')=>Response.json({id:'offline-conversation-123',model:'deepseek-flash',usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20},choices:[{finish_reason:'stop',message:{content:JSON.stringify({reply,stage:'clarify',suggestions:[],...(profile===undefined?{}:{profile})})}}]});
test('简短肯定/否定/不清楚的回复不因profile省略或局部更新而失败，坏字段仍拒绝',async()=>{
 const profile={conditions:[],goals:['瘦身'],notes:'用户自述维生素D缺乏'};
 for(const text of ['是的','没有','不清楚']){
  const result=await requestHealthChat({operationId:crypto.randomUUID(),apiKey:'sk-offline-conversation-12345',diseases:[],profile,messages:[{role:'user',content:'我想瘦身'},{role:'assistant',content:'平时是否很少晒太阳？'},{role:'user',content:text}]},AbortSignal.timeout(3000),async()=>receipt(undefined));
  assert.deepEqual(result.assessment?.profile,profile);
 }
 const request={operationId:crypto.randomUUID(),apiKey:'sk-offline-conversation-12345',diseases:[],profile,messages:[{role:'user' as const,content:'是的'}]};
 const partial=await requestHealthChat(request,AbortSignal.timeout(3000),async()=>receipt({notes:'更新的用户自述'}));assert.deepEqual(partial.assessment?.profile?.goals,['瘦身']);
 await assert.rejects(requestHealthChat(request,AbortSignal.timeout(3000),async()=>receipt({conditions:'错误的结构'})));
});

test('服务端用当前账户限制替换旧客户端限制，在途限制改变不保存旧回复',async()=>{
 const {db,accounts}=await fixture();let entered!:()=>void,release!:()=>void;
 const started=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);let calls=0;
 const app=await createApp({accounts,healthChatFetch:async(_url,init)=>{
  calls++;const sent=JSON.parse(String(init?.body));assert(!JSON.stringify(sent.messages).includes('旧限制示例'));
  const context=sent.messages.find((m:any)=>m.content.startsWith('用户当前本餐设置'));
  assert(context.content.includes('忌口：白菜'));assert(!context.content.includes('过敏：鱼'));
  entered();await gate;return receipt(undefined);
 }});
 try{
  const session=await app.inject('/api/v1/auth/session');const code=await accounts.registrationCode!('changes@example.invalid','changes');
  const identity=await accounts.register!({username:'context-change',password:'Change!Test123',code:'123456',challenge:code.challenge},'changes');
  let snap=await accounts.setHealthKey(identity,0,'sk-offline-conversation-12345');
  snap=await accounts.save(identity,snap.version,{...snap.value,defaults:{...defaultMeal(),restrictions:[{...makeRestriction('白菜','avoid'),status:'confirmed'}]}});
  const headers={cookie:`${String(session.headers['set-cookie']).split(';')[0]}; ${accounts.cookie(identity).split(';')[0]}`,origin:'http://localhost:80','x-csrf-token':session.json().csrfToken};
  const pending=app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:{operationId:crypto.randomUUID(),diseases:[],mealContext:{ingredients:[],seasonings:[],restrictions:['过敏：鱼'],allowBuy:false},messages:[{role:'user',content:'旧限制示例'},{role:'assistant',content:'旧限制示例'},{role:'user',content:'请继续'}]}}).then(r=>r);
  await started;await accounts.save(identity,snap.version,{...snap.value,defaults:{...snap.value.defaults!,restrictions:[]}});release();
  const response=await pending;assert.equal(response.statusCode,409);assert.equal(response.json().error.code,'CHAT_RESTRICTIONS_CHANGED');assert.equal(calls,1);assert.equal((await accounts.healthKey(identity)).profile,undefined);
 }finally{release();await app.close();await db.close();}
});
