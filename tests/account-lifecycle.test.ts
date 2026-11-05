import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fixture } from './registration-fixture';
import { CloudBaseAccounts } from '../backend/src/cloudbase-accounts';
import { AccountErasureWorkflow,type ErasureEvent } from '../backend/src/account-lifecycle';
import { createApp } from '../backend/src/app';

test('CloudBase注销闭环：先独立记录，再清加密账户/会话并删除身份；故障可由管理员续作且不复活账号',async()=>{
  const f=await fixture();await f.db.exec(await readFile('deployment/db/account-lifecycle.sql','utf8'));
  const events:ErasureEvent[]=[],journal={append:async(event:ErasureEvent)=>{events.push(event);},read:async(id:string)=>events.filter(e=>e.operationId===id)};
  let failDelete=true,deleteCalls=0;
  const service=async(sql:string,params:unknown[])=>{await f.db.exec('SET ROLE service_role');try{return await f.db.query(sql,params);}finally{await f.db.exec('RESET ROLE');}};
  const workflow=new AccountErasureWorkflow(journal,{begin:async(identity,op)=>{assert(events.some(e=>e.operationId===op&&e.stage==='intent'));await service('SELECT shiwei_erasure_begin($1,$2,$3)',[identity.userId,createHash('sha256').update(identity.sid).digest('hex'),op]);},finish:async(uid,op)=>{await service('SELECT shiwei_erasure_finish($1,$2)',[uid,op]);},deleteIdentityById:async uid=>{for(const [name,user] of f.users)if(user.uid===uid)f.users.delete(name);}});
  const accounts=new CloudBaseAccounts({...f.options,erasureWorkflow:workflow,fetch:async(input,init)=>{
    const url=new URL(String(input)),body=init?.body?JSON.parse(String(init.body)):{};
    if(url.pathname==='/auth/v1/user/sudo'){const user=[...f.users.values()].find(u=>new Headers(init?.headers).get('Authorization')===`Bearer token:${u.uid}`);return user&&body.password===user.password?Response.json({sudo_token:'verified-proof'}):Response.json({}, {status:401});}
    if(url.pathname==='/auth/v1/user/me'&&init?.method==='DELETE'){deleteCalls++;assert.equal(url.searchParams.get('sudo_token'),'verified-proof');return Response.json({}, {status:failDelete?503:200});}
    return f.options.fetch(input,init);
  }});
  const app=await createApp({accounts});
  try{
    const code=await accounts.registrationCode('erase@example.invalid','owner'),identity=await accounts.register({username:'erase-owner',password:'Erase!Test123',code:'123456',challenge:code.challenge},'owner');
    await accounts.setHealthKey(identity,0,'sk-erasure-test-only-123456789012345');
    const session=await app.inject('/api/v1/auth/session'),headers={cookie:`${String(session.headers['set-cookie']).split(';')[0]}; ${accounts.cookie(identity).split(';')[0]}`,origin:'http://localhost:80','x-csrf-token':session.json().csrfToken};
    assert.equal((await app.inject({method:'POST',url:'/api/v1/account/erasure',headers,payload:{password:'Erase!Test123',confirmation:'确认'}})).statusCode,400);
    await assert.rejects(accounts.eraseAccount(identity,'Wrong!Test123'));assert.equal(events.length,0);
    const r=await app.inject({method:'POST',url:'/api/v1/account/erasure',headers,payload:{password:'Erase!Test123',confirmation:'注销账号'}});assert.equal(r.statusCode,200,r.body);assert.equal(r.json().state,'pending');assert.equal(deleteCalls,1);
    assert.equal((await f.db.query<{envelope:unknown}>('SELECT envelope FROM shiwei_account_state')).rows[0].envelope,null);assert.equal((await f.db.query('SELECT * FROM shiwei_account_sessions')).rows.length,0);
    assert.equal(await accounts.authenticate(accounts.cookie(identity)),null);await assert.rejects(accounts.login('erase-owner','Erase!Test123'));
    await f.db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[identity.userId]);await f.db.exec('SET ROLE authenticated');
    await assert.rejects(f.db.query('SELECT shiwei_erasure_begin($1,$2,$3)',[identity.userId,'a'.repeat(64),crypto.randomUUID()]));
    await assert.rejects(f.db.query('DELETE FROM shiwei_account_tombstones'));assert.equal((await f.db.query("UPDATE shiwei_account_state SET envelope='{}'::jsonb WHERE owner_id=$1 RETURNING owner_id",[identity.userId])).rows.length,0);await f.db.exec('RESET ROLE');
    failDelete=false;await workflow.resume(r.json().operationId);await workflow.resume(r.json().operationId);
    assert.equal((await f.db.query<{state:string}>('SELECT state FROM shiwei_account_tombstones')).rows[0].state,'completed');assert.equal(f.users.size,0);assert.equal(events.filter(e=>e.stage==='completed').length,1);
    assert(!JSON.stringify(events).includes('sk-erasure'));assert(!JSON.stringify(events).includes('Erase!Test123'));
  }finally{await app.close();await f.db.close();}
});
test('独立日志不可写时不能删数据或身份，缺少管理员续作证据时停止而不伪造完成',async()=>{
  let writes=0;const workflow=new AccountErasureWorkflow({append:async()=>{throw Error('journal offline');},read:async()=>[]},{begin:async()=>{writes++;},finish:async()=>{writes++;},deleteIdentityById:async()=>{writes++;}});
  await assert.rejects(workflow.erase({userId:'u'} as any,async()=>{writes++;}));assert.equal(writes,0);await assert.rejects(workflow.resume(crypto.randomUUID()),{code:'ERASURE_JOURNAL_INVALID'});
  const events:ErasureEvent[]=[];
  const unknown=new AccountErasureWorkflow({append:async event=>{events.push(event);},read:async()=>events},{begin:async()=>{throw Error('begin response lost');},finish:async()=>{writes++;},deleteIdentityById:async()=>{writes++;}});
  const receipt=await unknown.erase({userId:'u'} as any,async()=>{writes++;});assert.equal(receipt.state,'pending');assert.equal(receipt.operationId,events[0].operationId);assert.equal(writes,0);
  await assert.rejects(unknown.resume(receipt.operationId),{code:'ERASURE_RECONCILIATION_REQUIRED'});
});
