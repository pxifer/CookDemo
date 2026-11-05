import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../backend/src/app';
import { fixture } from './registration-fixture';
import { readFoodGuidanceAssets, persistGuidanceAssets } from '../backend/src/rag/food-guidance-repository';
import { createFoodGuidanceProvider } from '../backend/src/rag/food-guidance';
import { mealWith, request } from './fixtures';
import { PGlite } from '@electric-sql/pglite';
const assets=await readFoodGuidanceAssets();
const provider=()=>createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set());
test('接入口仅允许显式local/loopback，不在默认或云端配置自动开启',async()=>{
  await assert.rejects(createApp({foodGuidance:provider()}),/local loopback/);
  await assert.rejects(createApp({foodGuidance:provider(),environment:'production',origin:'https://example.invalid'}),/local loopback/);
});
test('追加研究资产持久化回读、重复导入幂等、同ID变更和直接改写拒绝，不影响冻结研究表',async()=>{
  const db=new PGlite();try{
    await persistGuidanceAssets(db as any,assets);await persistGuidanceAssets(db as any,assets);
    const rows=await db.query<{id:string;payload:any}>('SELECT id,payload FROM health_kb.guidance_assets ORDER BY id');assert.equal(rows.rows.length,2);assert(rows.rows.some(r=>r.payload.topics?.some((t:any)=>t.id==='goal:muscle-gain')));
    await assert.rejects(db.exec("UPDATE health_kb.guidance_assets SET sha256=repeat('a',64)"));
    await assert.rejects(persistGuidanceAssets(db as any,{...assets,mappings:{...assets.mappings,objects:{}}}),/IMMUTABLE/);
    assert.equal((await db.query<{n:number}>('SELECT count(*)::int AS n FROM health_kb.health_facts')).rows[0].n,260);
  }finally{await db.close();}
});
test('真实API代码：自述→有来源食材建议→账户保存→实际选菜与依据；模拟供应商，零外部调用',async()=>{
  const {db,accounts}=await fixture(),key='sk-fixture-research-only-1234567890123';let calls=0;
  const app=await createApp({environment:'local',origin:'http://127.0.0.1:4175',accounts,foodGuidance:provider(),healthChatFetch:async()=>{throw Error('research guidance must not call chat model');},healthRecipeFetch:async(_u,init)=>{
    calls++;const packet=JSON.parse(JSON.parse(String(init?.body)).messages[1].content);assert(packet.evidenceGuidance.evidence.some((e:any)=>e.id==='goal-ev:exercise-scope'));
    const candidate=packet.catalog.find((c:any)=>c.ingredients.some((l:any)=>l.name==='鸡蛋')&&c.guidanceIds.length);assert(candidate);
    return Response.json({id:'mock-research-api-12345678',model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:40,total_tokens:140},choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'构造供模型选择使用',choices:[{id:candidate.id,reason:'构造，程序负责最终依据',guidanceIds:candidate.guidanceIds.slice(0,3)}]})}}]});
  }});
  try{
    const verification=await accounts.registrationCode('rag-business@example.invalid','rag-business');const identity=await accounts.register({username:'rag-business',password:'Research!123',code:'123456',challenge:verification.challenge},'rag-business');await accounts.setHealthKey(identity,0,key);
    const session=await app.inject('/api/v1/auth/session');assert.equal(session.json().healthGuidanceResearch,true);const headers={cookie:`${String(session.headers['set-cookie']).split(';')[0]}; ${accounts.cookie(identity).split(';')[0]}`,origin:'http://127.0.0.1:4175','x-csrf-token':session.json().csrfToken};
    const chat=await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:{operationId:crypto.randomUUID(),diseases:[],messages:[{role:'user',content:'我是成年人，我身体健康，我规律抗阻训练，我想增肌'}],profile:{conditions:['假冒疾病'],goals:[],notes:''}}});
    assert.equal(chat.statusCode,200,chat.body);const reply=chat.json();assert.equal(reply.knowledge,'research_rag');assert(!reply.invocation);assert(reply.assessment.suggestions.some((s:any)=>s.foodName==='鸡蛋'));assert(!reply.researchGuidance.topics.some((t:any)=>t.inputName==='假冒疾病'));assert(reply.accountSnapshot);
    const stored=await accounts.healthKey(identity);assert(stored.profile!.goals.includes('增肌'));assert(!stored.preferences?.preferred.length);
    const meal={...mealWith('西红柿600g鸡蛋5个'),health:true,composition:'custom' as const,counts:{meat:0,veg:1,soup:0},healthProfile:{conditions:['伪造'],goals:[],notes:'',suggestions:[],updatedAt:'2026-11-04'}};
    const result=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:request(meal)});
    assert.equal(result.statusCode,200,result.body);const value=result.json();assert.equal(value.status,'completed');assert(value.dishes[0].aiGrounding.matches.length);assert.match(value.dishes[0].aiReason,/增肌/);assert.equal(calls,1);assert(!result.body.includes(key));
    assert.equal((await db.query('SELECT * FROM shiwei_ai_chat_operations')).rows.length,1,'食材资料查询不认领付费调用，选菜只认领一次');
  }finally{await app.close();await db.close();}
});
