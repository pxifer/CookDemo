import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApp } from '../backend/src/app';
import { fixture } from './registration-fixture';
import { mealWith,request } from './fixtures';

test('同浏览器的独立页面任务不因另一个任务的高版本被误取消',async()=>{
  const app=await createApp();
  try{
    const session=await app.inject('/api/v1/auth/session'),headers={cookie:String(session.headers['set-cookie']).split(';')[0],origin:'http://localhost:80','x-csrf-token':session.json().csrfToken};
    const a=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:request({...mealWith(),version:99},{taskId:crypto.randomUUID()})});assert.equal(a.statusCode,200);
    const b=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:request({...mealWith(),version:0},{taskId:crypto.randomUUID()})});assert.equal(b.statusCode,200);assert.notEqual(b.json().status,'cancelled');
  }finally{await app.close();}
});

test('两个API实例共享任务水位：晚到结果取消、旧版本不消费、独立任务互不覆盖',async()=>{
  const {db,accounts}=await fixture();await db.exec(await readFile('deployment/db/recommendation-tasks.sql','utf8'));
  const registration=await accounts.registrationCode('task-test@example.invalid','task-test');
  const identity=await accounts.register({username:'task-test',password:'Task!Test123',code:'123456',challenge:registration.challenge},'task-test');
  const apiKey='sk-task-test-only-123456789012345';await accounts.setHealthKey(identity,0,apiKey);
  let calls=0,release!:()=>void,started!:()=>void;
  const begin=new Promise<void>(r=>{started=r;}),wait=new Promise<void>(r=>{release=r;});
  const fetcher:typeof fetch=async(_url,init)=>{
    const first=++calls===1,packet=JSON.parse(JSON.parse(String(init?.body)).messages.at(-1).content);
    if(first){started();await wait;}
    return Response.json({id:`task-test-call-${calls}-123456`,model:'deepseek-flash',usage:{prompt_tokens:50,completion_tokens:30,total_tokens:80},choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'构造任务版本测试',choices:packet.catalog.slice(0,packet.count).map((c:{id:string})=>({id:c.id,reason:'构造选择'}))})}}]});
  };
  const a=await createApp({accounts,healthRecipeFetch:fetcher,sharedRecommendationTasks:true}),b=await createApp({accounts,healthRecipeFetch:fetcher,sharedRecommendationTasks:true});
  try{
    const headersFor=async(app:typeof a)=>{const s=await app.inject('/api/v1/auth/session');return {cookie:`${String(s.headers['set-cookie']).split(';')[0]}; ${accounts.cookie(identity).split(';')[0]}`,origin:'http://localhost:80','x-csrf-token':s.json().csrfToken};};
    const ha=await headersFor(a),hb=await headersFor(b),taskId=crypto.randomUUID();
    const meal={...mealWith('西红柿600g鸡蛋5个'),health:true,composition:'custom' as const,counts:{meat:0,veg:1,soup:0}};
    const old=Promise.resolve(a.inject({method:'POST',url:'/api/v1/recommendations',headers:ha,payload:request({...meal,version:1},{taskId})}));await begin;
    const current=await b.inject({method:'POST',url:'/api/v1/recommendations',headers:hb,payload:request({...meal,version:2},{taskId})});assert.equal(current.statusCode,200,current.body);assert.equal(current.json().status,'completed');
    release();const late=await old;assert.equal(late.statusCode,200,late.body);assert.equal(late.json().status,'cancelled');assert.deepEqual(late.json().dishes,[]);assert.equal(late.json().cursor,'');
    const stale=await a.inject({method:'POST',url:'/api/v1/recommendations',headers:ha,payload:request({...meal,version:1},{taskId})});assert.equal(stale.statusCode,409);assert.equal(calls,2);
    const independent=await a.inject({method:'POST',url:'/api/v1/recommendations',headers:ha,payload:request(meal,{taskId:crypto.randomUUID()})});assert.equal(independent.statusCode,200,independent.body);assert.equal(independent.json().status,'completed');assert.equal(calls,3);
    const rows=(await db.query('SELECT * FROM shiwei_recommendation_tasks')).rows;assert.equal(rows.length,2);assert(!JSON.stringify(rows).includes(apiKey));assert(!JSON.stringify(rows).includes('西红柿'));
    await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT * FROM shiwei_recommendation_tasks'));await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub','another-owner',false)");await db.exec('SET ROLE authenticated');assert.equal((await db.query('SELECT * FROM shiwei_recommendation_tasks')).rows.length,0);await db.exec('RESET ROLE');
  }finally{release();await a.close();await b.close();await db.close();}
});
