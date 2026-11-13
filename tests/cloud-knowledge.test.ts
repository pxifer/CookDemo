import test from 'node:test';
import assert from 'node:assert/strict';
import {readFoodGuidanceAssets} from '../backend/src/rag/food-guidance-repository';
import {createCloudKnowledge} from '../backend/src/rag/cloud-knowledge';
import {canonicalKnowledgeHash} from '../backend/src/health-knowledge';
import {constructedContent} from '../shared/catalog';
import {requestHealthChat} from '../backend/src/health-chat';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {fixture} from './registration-fixture';
import {createApp} from '../backend/src/app';
const assets=await readFoodGuidanceAssets();
const payload={bundle:assets.bundle,goals:assets.goals,mappings:assets.mappings,expansion:assets.expansion};
const hash=canonicalKnowledgeHash(payload);
test('公开知识RLS：未发布不可读、匿名不可写；内容不可变且撤回不可逆',async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;');
 await db.exec(await readFile('deployment/db/public-knowledge-release.sql','utf8'));
 await db.query("INSERT INTO public.shiwei_knowledge_releases(release_id,checksum,payload) VALUES('knowledge-test-v1',$1,'{}')",[hash]);
 await db.exec('SET ROLE anon');assert.equal((await db.query('SELECT release_id FROM public.shiwei_knowledge_releases')).rows.length,0);
 await assert.rejects(db.exec("UPDATE public.shiwei_knowledge_releases SET published=true"));await db.exec('RESET ROLE');
 await db.exec("UPDATE public.shiwei_knowledge_releases SET published=true,revocations='[\"withdrawn\"]'");
 await db.exec('SET ROLE anon');assert.equal((await db.query('SELECT release_id FROM public.shiwei_knowledge_releases')).rows.length,1);await db.exec('RESET ROLE');
 await assert.rejects(db.exec("UPDATE public.shiwei_knowledge_releases SET payload='{\"changed\":true}'"));
 await assert.rejects(db.exec("UPDATE public.shiwei_knowledge_releases SET revocations='[]'"));
 await assert.rejects(db.exec('DELETE FROM public.shiwei_knowledge_releases'));
 }finally{await db.close();}
});
test('网站真实账户路径继续要求个人Key与共享认领，模型收到知识；重复请求和撤回拒绝',async()=>{
 const {db,accounts}=await fixture();let calls=0,available=true;
 const knowledge=createCloudKnowledge({envId:'shiwei-test',key:'public-test',releaseId:'knowledge-test-v1',hash,fetch:async()=>Response.json(available?[{checksum:hash,revocations:[],payload}]:[])});
 const app=await createApp({accounts,publishedKnowledge:knowledge,healthChatFetch:async(_u,init)=>{calls++;assert(JSON.parse(String(init?.body)).messages.some((m:any)=>m.content.includes(assets.expansion.id)));return Response.json({id:'mock-knowledge',model:'deepseek-flash',usage:{prompt_tokens:20,completion_tokens:20,total_tokens:40},choices:[{finish_reason:'stop',message:{content:JSON.stringify({reply:'按给定来源作参考。',stage:'advice',suggestions:[]})}}]});}});
 try{
 const code=await accounts.registrationCode!('cloud-kb@example.invalid','kb-test');const id=await accounts.register!({username:'cloud-kb-test',password:'Cloud!Test123',code:'123456',challenge:code.challenge},'kb-test');await accounts.setHealthKey(id,0,'sk-local-cloud-kb-test-1234567890');
 const session=await app.inject('/api/v1/auth/session'),headers={cookie:`${String(session.headers['set-cookie']).split(';')[0]}; ${accounts.cookie(id).split(';')[0]}`,origin:'http://localhost:80','x-csrf-token':session.json().csrfToken};
 const body={operationId:crypto.randomUUID(),messages:[{role:'user',content:'我有便秘'}],diseases:[]};
 const response=await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:body});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().knowledge,'source_rag');assert.equal(response.json().researchGuidance.mode,'source_guidance');assert.equal(calls,1);
 assert.equal((await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:body})).statusCode,409);assert.equal(calls,1);
 available=false;assert.notEqual((await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:{...body,operationId:crypto.randomUUID()}})).statusCode,200);assert.equal(calls,1);
 }finally{await app.close();await db.close();}
});
test('云知识只读、完整性、显式条件、撤回及故障均不能沿用旧依据',async()=>{
 let published=true,badHash=false,failed=false;const revoked:string[]=[];let calls=0;
 const p=createCloudKnowledge({envId:'shiwei-test',key:'public-test',releaseId:'knowledge-test-v1',hash,fetch:async(url,init)=>{
  calls++;assert.equal(init?.redirect,'error');assert(!init?.method||init.method==='GET');assert(!init?.body);assert(!String(url).includes('便秘'));
  if(failed)return new Response('',{status:503});return Response.json(published?[{checksum:badHash?'0'.repeat(64):hash,revocations:revoked,payload}]:[]);
 }});
 const input={profile:{conditions:['便秘'],goals:[],notes:''},content:constructedContent};
 const packet=await p.prepare(input);assert.equal(packet.mode,'source_guidance');assert(packet.knowledgeVersion.includes('nutrition-guidance-2026-11-13-v1'));await p.assertCurrent(packet);
 revoked.push(assets.expansion.id);await assert.rejects(p.assertCurrent(packet));revoked.pop();
 published=false;await assert.rejects(p.assertCurrent(packet));published=true;badHash=true;await assert.rejects(p.prepare(input));badHash=false;
 failed=true;await assert.rejects(p.prepare(input));assert(calls>3);
});
test('源库提示保留事实及限定证据，个人Key单次调用；过大上下文调用前拒绝',async()=>{
 const p=createCloudKnowledge({envId:'shiwei-test',key:'public-test',releaseId:'knowledge-test-v1',hash,fetch:async()=>Response.json([{checksum:hash,revocations:[],payload}])});
 const packet=await p.prepare({profile:{conditions:['便秘'],goals:[],notes:''},content:constructedContent});
 let calls=0;const body={operationId:crypto.randomUUID(),apiKey:'sk-local-test-only-1234567890',messages:[{role:'user' as const,content:'我有便秘'}],diseases:['便秘']};
 const fetcher:typeof fetch=async(_url,init)=>{calls++;const sent=JSON.parse(String(init?.body));assert(sent.messages.some((m:any)=>m.content.includes(packet.knowledgeVersion)));assert(!sent.messages[0].content.includes('没有接入本站已核验RAG'));return Response.json({id:'mock-local',model:'deepseek-flash',usage:{prompt_tokens:20,completion_tokens:20,total_tokens:40},choices:[{finish_reason:'stop',message:{content:JSON.stringify({reply:'按给定来源作定性参考。',stage:'clarify',suggestions:[]})}}]});};
 const r=await requestHealthChat(body,new AbortController().signal,fetcher,()=>true,[],packet);assert.equal(r.knowledge,'source_rag');assert.equal(calls,1);
 const b7=await p.prepare({profile:{conditions:[],goals:[],notes:''},content:constructedContent,currentText:'维生素B7'});
 const reference=b7.nutritionReference as any;assert(reference);assert(reference.foods.every((f:any)=>f.values.every((v:any)=>v.status==='not_reported'&&v.value===null)));assert(reference.interpretation.includes('缺失不等于零'));
 await assert.rejects(requestHealthChat(body,new AbortController().signal,fetcher,()=>true,[],{...packet,uncoveredTopics:['x'.repeat(41000)]}));assert.equal(calls,1);
});
