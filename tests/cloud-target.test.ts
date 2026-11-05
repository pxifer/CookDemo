import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudTarget } from '../backend/src/cloud-target';
import { stagingAccounts } from '../backend/src/staging-accounts';
import { fixture } from './registration-fixture';
import { CloudBaseAccounts } from '../backend/src/cloudbase-accounts';
import { createApp } from '../backend/src/app';
test('测试目标必须与生产隔离且有测试账号名单，不能改一个环境变量就误指生产',()=>{
  const env={APP_STAGE:'staging',APP_ORIGIN:'https://staging.example.invalid',CLOUDBASE_ENV_ID:'shiwei-test-only',STAGING_ENV_ID:'shiwei-test-only',STAGING_ALLOWED_USER_IDS:'allowed-test'};
  assert.equal(cloudTarget(env).stage,'staging');assert.throws(()=>cloudTarget({...env,STAGING_ALLOWED_USER_IDS:''}));
  assert.throws(()=>cloudTarget({...env,CLOUDBASE_ENV_ID:'shiwei-d2gmiun66b7dc6a4f',STAGING_ENV_ID:'shiwei-d2gmiun66b7dc6a4f'}));
  assert.throws(()=>cloudTarget({...env,APP_STAGE:'production'}));
  assert.throws(()=>cloudTarget({...env,PASSWORD_RECOVERY_ENABLED:'1'}),/STAGING_RECOVERY_EMAILS_REQUIRED/);
  assert.throws(()=>cloudTarget({...env,STAGING_RECOVERY_EMAILS:'not-an-email'}),/STAGING_RECOVERY_EMAILS_REQUIRED/);
  assert.deepEqual(cloudTarget({...env,PASSWORD_RECOVERY_ENABLED:'1',STAGING_RECOVERY_EMAILS:' Test@example.invalid '}).testRecoveryEmails,['test@example.invalid']);
  assert.throws(()=>cloudTarget({...env,STAGING_RECOVERY_EMAILS:Array(21).fill('test@example.invalid').join(',')}),/STAGING_RECOVERY_EMAILS_REQUIRED/);
});
test('测试站找回仅向明确邮箱发信；完成阶段重查密封邮箱，旧挑战不能绕过名单变更',async()=>{
  const f=await fixture();
  try{
    const signup=await f.accounts.registrationCode('recover-test@example.invalid','owner');
    const id=await f.accounts.register({username:'staging-recovery',password:'Original!123',code:'123456',challenge:signup.challenge},'owner');
    const emails=['recover-test@example.invalid'];
    const restricted=new CloudBaseAccounts({...f.options,recoveryEnabled:true,recoveryAllowedEmails:emails});
    const limited=stagingAccounts(restricted,[id.userId],{passwordRecoveryEnabled:true});
    assert.equal(limited.recoveryAvailable,true);assert.equal(limited.registrationAvailable,false);
    const before=f.requests.length;
    for(const email of ['other@example.invalid','recover-test+alias@example.invalid'])await assert.rejects(limited.recoveryCode!(email,'guest'),{code:'STAGING_ACCOUNT_REQUIRED'});
    await assert.rejects(limited.registrationCode!('recover-test@example.invalid','guest'),{code:'STAGING_ACCOUNT_REQUIRED'});
    assert.equal(f.requests.length,before);
    // Configuration is snapshotted, not a mutable list that can be broadened later.
    emails.push('other@example.invalid');
    await assert.rejects(limited.recoveryCode!('other@example.invalid','guest'),{code:'STAGING_ACCOUNT_REQUIRED'});
    const challenge=await limited.recoveryCode!('recover-test@example.invalid','guest');
    const afterSend=f.requests.length;
    const changed=new CloudBaseAccounts({...f.options,recoveryEnabled:true,recoveryAllowedEmails:['next-test@example.invalid']});
    await assert.rejects(changed.recoverPassword({challenge:challenge.challenge,code:'123456',newPassword:'Changed!123'},'guest'),{code:'STAGING_ACCOUNT_REQUIRED'});
    assert.equal(f.requests.length,afterSend); // No verification consumption or reset.
    await limited.recoverPassword!({challenge:challenge.challenge,code:'123456',newPassword:'Changed!123'},'guest');
    assert.equal(await limited.authenticate(limited.cookie(id)),null);
    assert.equal((await limited.login('staging-recovery','Changed!123')).userId,id.userId);
    assert.equal(f.requests.filter(r=>r.path==='/auth/v1/reset').length,1);
  }finally{await f.db.close();}
});
test('受控找回走实际API，访客无需已登录；空名单和默认测试包装器仍关闭功能',async()=>{
  const f=await fixture();
  const accounts=new CloudBaseAccounts({...f.options,recoveryEnabled:true,recoveryAllowedEmails:['API-test@example.invalid']});
  const app=await createApp({accounts:stagingAccounts(accounts,['test-uid'],{passwordRecoveryEnabled:true})});
  try{
    assert.equal(new CloudBaseAccounts({...f.options,recoveryEnabled:true,recoveryAllowedEmails:[]}).recoveryAvailable,false);
    assert.throws(()=>new CloudBaseAccounts({...f.options,recoveryAllowedEmails:['invalid']}),/RECOVERY_EMAIL_CONFIGURATION/);
    assert.equal(stagingAccounts(accounts,['test-uid']).recoveryAvailable,false);
    await assert.rejects(stagingAccounts(accounts,['test-uid']).recoveryCode!('api-test@example.invalid','guest'),{code:'STAGING_ACCOUNT_REQUIRED'});
    const session=await app.inject('/api/v1/auth/session');assert.equal(session.json().recoveryAvailable,true);
    const headers={cookie:String(session.headers['set-cookie']).split(';')[0],origin:'http://localhost:80','x-csrf-token':session.json().csrfToken};
    const before=f.requests.length;
    const denied=await app.inject({method:'POST',url:'/api/v1/auth/recovery/code',headers,payload:{email:'blocked@example.invalid'}});
    assert.equal(denied.statusCode,403);assert.equal(f.requests.length,before);
    // Unknown allowed test addresses retain the existing anti-enumeration response.
    const allowed=await app.inject({method:'POST',url:'/api/v1/auth/recovery/code',headers,payload:{email:' API-test@example.invalid '}});
    assert.equal(allowed.statusCode,200);assert.equal(typeof allowed.json().challenge,'string');
    assert(!allowed.body.includes('user_not_found'));
  }finally{await app.close();await f.db.close();}
});
test('测试入口拒绝未列入名单的账户，不开放真实注册或找回邮件',async()=>{
  const f=await fixture();
  try{
    const c=await f.accounts.registrationCode('staging@example.invalid','staging'),id=await f.accounts.register({username:'staging-owner',password:'Staging!123',code:'123456',challenge:c.challenge},'staging');
    const limited=stagingAccounts(f.accounts,[]);assert.equal(await limited.authenticate(f.accounts.cookie(id)),null);
    await assert.rejects(limited.login('staging-owner','Staging!123'),{code:'STAGING_ACCOUNT_REQUIRED'});
    assert.equal(limited.registrationAvailable,false);await assert.rejects(limited.registrationCode!('no-mail@example.invalid','x'));
    const admitted=stagingAccounts(f.accounts,[id.userId]);assert.equal((await admitted.login('staging-owner','Staging!123')).userId,id.userId);
  }finally{await f.db.close();}
});
