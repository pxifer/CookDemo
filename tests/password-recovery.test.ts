import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './registration-fixture';
import { CloudBaseAccounts } from '../backend/src/cloudbase-accounts';
import { createApp } from '../backend/src/app';

test('邮箱找回：按官方协议重置、撤销全部应用会话、保留加密资料；验证码不能跨用途或重放',async()=>{
  const {db,options,requests}=await fixture(),accounts=new CloudBaseAccounts({...options,recoveryEnabled:true});
  try{
    const signup=await accounts.registrationCode('recover@example.invalid','owner');
    const identity=await accounts.register({username:'recovery-owner',password:'Original!123',code:'123456',challenge:signup.challenge},'owner');
    const saved=await accounts.load(identity);await accounts.save(identity,saved.version,{...saved.value,favorites:[{recipeId:'saved',variantId:'saved-v'}]});
    const otherSession=await accounts.login('recovery-owner','Original!123');
    const code=await accounts.recoveryCode('recover@example.invalid','guest');
    await assert.rejects(accounts.recoverPassword({challenge:signup.challenge,code:'123456',newPassword:'Changed!123'},'owner'),{code:'VERIFICATION_EXPIRED'});
    await assert.rejects(accounts.recoverPassword({challenge:code.challenge,code:'123456',newPassword:'Changed!123'},'another-guest'),{code:'VERIFICATION_EXPIRED'});
    await assert.rejects(accounts.recoverPassword({challenge:code.challenge,code:'123456',newPassword:'weak'},'guest'),{code:'INVALID_RECOVERY'});
    await accounts.recoverPassword({challenge:code.challenge,code:'123456',newPassword:'Changed!123'},'guest');
    assert.equal(await accounts.authenticate(accounts.cookie(identity)),null);assert.equal(await accounts.authenticate(accounts.cookie(otherSession)),null);
    await assert.rejects(accounts.login('recovery-owner','Original!123'));
    const current=await accounts.login('recovery-owner','Changed!123');assert.deepEqual((await accounts.load(current)).value.favorites,[{recipeId:'saved',variantId:'saved-v'}]);
    await assert.rejects(accounts.recoverPassword({challenge:code.challenge,code:'123456',newPassword:'Another!123'},'guest'));
    assert.equal(requests.filter(r=>r.path==='/auth/v1/reset').length,1);
    assert.equal(requests.find(r=>r.path==='/auth/v1/verification'&&r.body.target==='USER')?.body.email,'recover@example.invalid');
  }finally{await db.close();}
});
test('找回API有开关、同源CSRF、严格字段和冷却；未知邮箱不泄露注册状态',async()=>{
  const {db,options}=await fixture(),accounts=new CloudBaseAccounts({...options,recoveryEnabled:true}),app=await createApp({accounts});
  try{
    const s=await app.inject('/api/v1/auth/session');assert.equal(s.json().recoveryAvailable,true);
    const headers={cookie:String(s.headers['set-cookie']).split(';')[0],origin:'http://localhost:80','x-csrf-token':s.json().csrfToken};
    const bad=await app.inject({method:'POST',url:'/api/v1/auth/recovery/code',headers:{...headers,origin:'https://evil.invalid'},payload:{email:'absent@example.invalid'}});assert.equal(bad.statusCode,403);
    const result=await app.inject({method:'POST',url:'/api/v1/auth/recovery/code',headers,payload:{email:'absent@example.invalid'}});assert.equal(result.statusCode,200);assert.equal(typeof result.json().challenge,'string');assert(!result.body.includes('user_not_found'));
    assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/recovery/code',headers,payload:{email:'absent@example.invalid'}})).statusCode,429);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/recovery/complete',headers,payload:{challenge:result.json().challenge,code:'123456',newPassword:'Changed!123',userId:'victim'}})).statusCode,400);
    const disabled=new CloudBaseAccounts(options);await assert.rejects(disabled.recoveryCode('absent@example.invalid','guest'),{code:'RECOVERY_UNAVAILABLE'});
  }finally{await app.close();await db.close();}
});
test('重置网络结果未知不自动补发，也不假装已退出所有设备',async()=>{
  const {db,options}=await fixture();let calls=0;
  const accounts=new CloudBaseAccounts({...options,recoveryEnabled:true,fetch:async(input,init)=>{if(String(input).endsWith('/auth/v1/reset')){calls++;throw Error('upstream unavailable');}return options.fetch(input,init);}});
  try{
    const signup=await accounts.registrationCode('unknown@example.invalid','owner');await accounts.register({username:'unknown-owner',password:'Original!123',code:'123456',challenge:signup.challenge},'owner');
    const code=await accounts.recoveryCode('unknown@example.invalid','guest');
    await assert.rejects(accounts.recoverPassword({challenge:code.challenge,code:'123456',newPassword:'Changed!123'},'guest'),{code:'RECOVERY_RESULT_UNKNOWN'});assert.equal(calls,1);
  }finally{await db.close();}
});
