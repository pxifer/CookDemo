import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../backend/src/app';
import {readImageModelConfig,recognizeImage,validateImage} from '../backend/src/image-recognition';
import {constructedContent} from '../shared/catalog';
import {fixture} from './registration-fixture';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const key='sk-offline-image-test-123456789';
const success=(foods=['鸡蛋','西红柿'],uncertain=['被遮挡的蔬菜'])=>Response.json({id:'offline-image-response-123',model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130},choices:[{finish_reason:'stop',message:{content:JSON.stringify({foods,uncertain})}}]});
test('图片格式和固定供应商配置：拒绝远程URL、伪造类型和任意供应商',()=>{
  validateImage(image);
  assert.throws(()=>validateImage('https://example.invalid/photo.jpg'));
  assert.throws(()=>validateImage(image.replace('image/png','image/jpeg')));
  assert.throws(()=>readImageModelConfig({IMAGE_MODEL_PROVIDER:'other'}));
  assert.throws(()=>readImageModelConfig({IMAGE_MODEL_PROVIDER:'zhipu'}));
  assert.deepEqual(readImageModelConfig({}),{provider:'deepseek'});
});
test('两种视觉适配：只发送图片与食材提示，结果无用量、不改变限制；错误不重试',async()=>{
  for(const provider of ['deepseek','zhipu'] as const){let calls=0;
    const result=await recognizeImage(image,'offline-op',{provider},key,constructedContent,AbortSignal.timeout(5000),async(url,init)=>{
      calls++;assert.equal(String(url),provider==='deepseek'?'https://api.deepseek.com/chat/completions':'https://open.bigmodel.cn/api/paas/v4/chat/completions');assert.equal(init?.redirect,'error');
      const body=JSON.parse(String(init?.body));assert.equal(body.model,provider==='deepseek'?'deepseek-flash':'glm-4.6v-flash');assert.equal(body.thinking.type,'disabled');assert.equal(body.messages[0].content[1].image_url.url,image);return success();
    });
    assert.equal(calls,1);assert.deepEqual(result.extraction.ingredients.map(i=>i.amount),['','']);assert.deepEqual(result.extraction.restrictions,[]);assert.equal(result.extraction.servings,null);assert.equal(result.extraction.ingredients[0].status,'pending');
  }
  let calls=0;await assert.rejects(recognizeImage(image,'op',{provider:'deepseek'},key,constructedContent,AbortSignal.timeout(5000),async()=>{calls++;return new Response('',{status:503});}));assert.equal(calls,1);
  await assert.rejects(recognizeImage(image,'op',{provider:'deepseek'},key,constructedContent,AbortSignal.timeout(5000),async()=>success(['鸡蛋2个'])));
});
test('识图API：登录、来源、Key、内容版本、原子重复限制与识别后推荐完整链路',async()=>{
  const {db,accounts}=await fixture();let calls=0;
  const app=await createApp({accounts,imageRecognitionFetch:async()=>{calls++;return success();}});
  try{
    const session=await app.inject('/api/v1/auth/session'),guest=String(session.headers['set-cookie']).split(';')[0];
    const headers={cookie:guest,origin:'http://localhost:80','x-csrf-token':session.json().csrfToken};
    const payload={operationId:crypto.randomUUID(),image};
    assert.equal((await app.inject({method:'POST',url:'/api/v1/recognitions/image',headers,payload})).statusCode,401);
    const code=await accounts.registrationCode!('image@example.invalid','offline-image');
    const identity=await accounts.register!({username:'image-tester',password:'Image!Test123',code:'123456',challenge:code.challenge},'offline-image');
    headers.cookie+=`; ${accounts.cookie(identity).split(';')[0]}`;
    assert.equal((await app.inject({method:'POST',url:'/api/v1/recognitions/image',headers,payload})).statusCode,400);
    await accounts.setHealthKey(identity,0,key);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/recognitions/image',headers:{...headers,origin:'https://evil.invalid'},payload})).statusCode,403);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/recognitions/image',headers,payload:{...payload,contentVersion:'stale'}})).statusCode,409);
    const response=await app.inject({method:'POST',url:'/api/v1/recognitions/image',headers,payload});assert.equal(response.statusCode,200);assert.equal(calls,1);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/recognitions/image',headers,payload})).statusCode,409);assert.equal(calls,1);
    assert.equal(response.json().extraction.ingredients[0].foodId,'egg');assert(!response.body.includes(key));assert(!response.body.includes('base64'));
    const claims=(await db.query('SELECT * FROM shiwei_ai_chat_operations')).rows;assert.equal(claims.length,1);assert(!JSON.stringify(claims).includes('base64'));assert(!JSON.stringify(claims).includes(key));
  }finally{await app.close();await db.close();}
});
