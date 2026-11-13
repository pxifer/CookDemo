import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {openOutputLiveFetch,validateSimulationPolicy,simulationExecutionPolicy} from '../scripts/lib/output-evaluation-budget';

test('更多模拟输入只扩内部次数门禁，5元上限/无重试与原账本不能改写',()=>{
 assert.equal(validateSimulationPolicy(simulationExecutionPolicy).maximumCny,5);
 assert.throws(()=>validateSimulationPolicy({...simulationExecutionPolicy,maximumCny:10}),/INVALID/);
 assert.throws(()=>validateSimulationPolicy({...simulationExecutionPolicy,maximumAttempts:1000}),/INVALID/);
 assert.throws(()=>validateSimulationPolicy({...simulationExecutionPolicy,automaticRetry:true}),/INVALID/);
});

test('新5元账本先预留、失败不退款、重开不清零；第二进程锁拒绝并发，Key不落盘',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.UTC(2026,10,13,4)});
 const root=resolve('.local-data');await mkdir(root,{recursive:true});const dir=await mkdtemp(join(root,'output-budget-test-'));
 let budget:Awaited<ReturnType<typeof openOutputLiveFetch>>|undefined;
 try{
  let calls=0;budget=await openOutputLiveFetch(dir,async()=>{calls++;throw Error('network fixture');});
  await assert.rejects(openOutputLiveFetch(dir),/EEXIST/);
  const request={method:'POST',redirect:'error' as const,headers:{Authorization:'Bearer sensitive-fixture-key'},body:JSON.stringify({model:'deepseek-flash',stream:false,max_tokens:2400,messages:[{role:'user',content:'x'.repeat(240000)}]})};
  await assert.rejects(budget.fetch('https://wrong.invalid',request),/DESTINATION/);assert.equal(calls,0);
  for(let i=0;i<12;i++)await assert.rejects(budget.fetch('https://api.deepseek.com/chat/completions',request));
  const reserved=budget.reservedMicroCny();assert(reserved>0&&reserved<=5e6);assert.equal(calls,budget.networkAttempts());assert(calls<12);
  await budget.close();budget=undefined;
  budget=await openOutputLiveFetch(dir,async()=>{throw Error('must not run');});assert.equal(budget.reservedMicroCny(),reserved);
  const walk=async(path:string):Promise<string[]>=>{const entries=await readdir(path,{withFileTypes:true});return (await Promise.all(entries.filter(e=>!e.name.endsWith('.lock')).map(e=>e.isDirectory()?walk(join(path,e.name)):Promise.resolve([join(path,e.name)])))).flat();};
  for(const file of await walk(dir))assert(!(await readFile(file,'utf8')).includes('sensitive-fixture-key'));
 }finally{await budget?.close();t.mock.timers.reset();if(!dir.startsWith(root+sep)||!dir.includes('output-budget-test-'))throw Error('BAD_TEST_DIRECTORY');await rm(dir,{recursive:true});}
});
