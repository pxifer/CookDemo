import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { localHttpUrl, localTestEnvironment } from '../scripts/local-test-guard.mjs';
import { assertLocalTestDatabase } from '../scripts/lib/local-test-config';

test('本地测试只接受回环HTTP和项目本地数据库，拒绝远程地址及PG主机覆盖',()=>{
  for(const url of ['http://127.0.0.1:4175','http://localhost:4178','https://[::1]:443','ws://127.0.0.1:4175'])assert(localHttpUrl(url));
  for(const url of ['https://api.deepseek.com','https://example.invalid','http://127.0.0.1.evil.invalid','https://localhost@evil.invalid','file:///secret'])assert(!localHttpUrl(url));
  assertLocalTestDatabase('postgres://user:fixture@127.0.0.1:5432/shiwei_test_structure',true);
  for(const url of ['postgres://user:fixture@db.example.invalid/shiwei_test_structure','postgres://user:fixture@127.0.0.1/postgres','postgres://user:fixture@127.0.0.1/shiwei_local?host=db.example.invalid','postgres://user:fixture@127.0.0.1/shiwei_local?hostaddr=203.0.113.1'])assert.throws(()=>assertLocalTestDatabase(url),/LOCAL_TEST_DATABASE_REQUIRED/);
  assert.throws(()=>assertLocalTestDatabase('postgres://user:fixture@127.0.0.1/shiwei_local',true));
});
test('子进程清除云端和模型配置，明确禁止付费；不污染调用方环境',()=>{
  const source={PATH:'fixture-path',CLOUDBASE_ENV_ID:'fixture',SHIWEI_EVALUATION_KEY_FILE:'do-not-open',EVALUATION_ALLOW_PAID:'1',MODEL_ENABLED:'1',DATABASE_URL:'remote',TEST_DATABASE_URL_FILE:'remote-file',HTTPS_PROXY:'remote',APP_ENV:'production',RUN_POSTGRES_TESTS:'1',CANDIDATE_PG_INTEGRATION:'1'};
  const saved={...source},env=localTestEnvironment(source,'file:///fixture-guard.mjs');
  assert.equal(env.PATH,source.PATH);assert.equal(env.APP_ENV,'local');assert.equal(env.CI,'1');assert.equal(env.EVALUATION_ALLOW_PAID,'0');assert.equal(env.MODEL_ENABLED,'0');
  for(const key of ['CLOUDBASE_ENV_ID','SHIWEI_EVALUATION_KEY_FILE','DATABASE_URL','TEST_DATABASE_URL_FILE','HTTPS_PROXY','RUN_POSTGRES_TESTS','CANDIDATE_PG_INTEGRATION'])assert.equal(env[key],undefined);
  assert.deepEqual(source,saved);
});
test('实际预加载在发出请求前拒绝原生fetch/http/https，不包含目标或凭证',()=>{
  const guard=pathToFileURL(resolve('scripts/local-test-guard.mjs')).href;
  const result=spawnSync(process.execPath,['--input-type=module','-e',`import http from 'node:http';import https from 'node:https';
    const calls=[()=>fetch('https://example.invalid/private?token=fixture'),()=>http.get('http://example.invalid'),()=>https.request({hostname:'example.invalid',path:'/'}),()=>http.request('http://localhost',{hostname:'example.invalid'})];
    for(const call of calls){try{await call();process.exit(1);}catch(e){if(e.code!=='LOCAL_TEST_NETWORK_BLOCKED'||e.message.includes('fixture')||e.message.includes('example.invalid'))process.exit(2);}}
    console.log('guard-blocked-before-network');`],{encoding:'utf8',timeout:10000,windowsHide:true,env:localTestEnvironment(process.env,guard)});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/guard-blocked-before-network/);
});
