import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../backend/src/app';
import {constructedContent} from '../shared/catalog';

test('公开缓存入口仅允许显式local、回环origin、repository与release，不影响云端限制',async()=>{
  const contentRepository={load:async()=>constructedContent,candidates:async()=>[]};
  for(const changes of [{environment:'production',origin:'https://example.invalid'}, {environment:'local',origin:'https://example.invalid'}, {environment:'local',origin:undefined}, {environment:'local',contentRepository:undefined}, {environment:'local',contentRelease:undefined}]){
    await assert.rejects(createApp(Object.assign({environment:'local',origin:'http://127.0.0.1:15199',contentSource:'local-cache',contentRelease:'public-cache',contentRepository},changes) as any),/local loopback/);
  }
});

test('公开缓存的目录/食材识别读取显式快照，不静默使用构造目录或联网',async()=>{
  let loads=0;const snapshot={...constructedContent,contentVersion:'local-public-cache-test',recipes:constructedContent.recipes.slice(0,1)};
  const app=await createApp({environment:'local',origin:'http://127.0.0.1:15199',contentSource:'local-cache',contentRelease:snapshot.contentVersion,
    contentRepository:{load:async()=>{loads++;return snapshot;},candidates:async()=>[]}});
  try{
    const value=(await app.inject('/api/v1/catalog/recipes')).json();assert.equal(value.contentVersion,snapshot.contentVersion);assert.equal(value.recipes.length,1);
    assert.deepEqual((await app.inject('/api/v1/local/candidate-recipes')).json(),{recommendationAvailable:true,recipes:[]});assert(loads>0);
  }finally{await app.close();}
});
