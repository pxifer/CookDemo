import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { CloudBaseAccounts } from '../backend/src/cloudbase-accounts';
import { createApp } from '../backend/src/app';
import { open,seal } from '../backend/src/crypto';
import { defaultMeal } from '../shared/types';

import { fixture } from "./registration-fixture";
const credentials={username:'new-alice',password:'Ab1!xyZ9',code:'123456'};
test('公开注册：先验邮箱及官方token，自己设的密码无需强制修改，跨设备加密保存且账号隔离',async()=>{
  const {db,accounts,options,requests}=await fixture();
  try{
    const a=await accounts.registrationCode('alice@example.invalid','guest-a');
    assert.ok(!a.challenge.includes('alice@example.invalid'));
    const alice=await accounts.register({...credentials,challenge:a.challenge},'guest-a');
    assert.equal(alice.mustChangePassword,false);
    const b=await accounts.registrationCode('bob@example.invalid','guest-b');
    const bob=await accounts.register({...credentials,username:'new-bob',challenge:b.challenge},'guest-b');
    assert.notEqual(alice.userId,bob.userId);
    const defaults={...defaultMeal(),restrictions:[{id:'constructed',kind:'allergy' as const,name:'花生',targets:['peanut'],status:'confirmed' as const,scope:'self' as const,original:'构造过敏测试'}]};
    const saved=await accounts.save(alice,0,{favorites:[{recipeId:'tomato-egg',variantId:'tomato-egg-light'}],defaults});
    const other=new CloudBaseAccounts(options),login=await other.login(credentials.username,credentials.password);
    assert.deepEqual(await other.load(login),saved);assert.deepEqual((await accounts.load(bob)).value,{favorites:[],defaults:null});
    assert.equal(JSON.stringify((await db.query('SELECT envelope FROM shiwei_account_state')).rows).includes('花生'),false);
    assert.equal(requests.some(r=>r.path.includes('/rdb/')&&JSON.stringify(r.body).includes(credentials.password)),false);
    await accounts.logout(alice);assert.equal(await accounts.authenticate(accounts.cookie(alice)),null);
    const signupIndex=requests.findIndex(r=>r.path==='/auth/v1/signup'),verificationIndex=requests.findIndex(r=>r.path==='/auth/v1/verification/verify');
    assert.ok(verificationIndex<signupIndex);assert.ok(requests.slice(signupIndex+1).some(r=>r.path==='/auth/v1/token/introspect'));
  }finally{await db.close();}
});
test('邮箱证明绑定会话/用途/有效期，错误验证码、篡改、重放和弱密码均不能创建账号',async()=>{
  const {db,accounts,options,users,requests}=await fixture();
  try{
    const a=await accounts.registrationCode('alice@example.invalid','guest-a');
    await assert.rejects(accounts.register({...credentials,challenge:a.challenge},'guest-b'),{code:'VERIFICATION_EXPIRED'});
    await assert.rejects(accounts.register({...credentials,challenge:a.challenge+'tampered'},'guest-a'),{code:'VERIFICATION_EXPIRED'});
    await assert.rejects(accounts.register({...credentials,challenge:a.challenge,code:'000000'},'guest-a'),{code:'INVALID_VERIFICATION'});
    await assert.rejects(accounts.register({...credentials,challenge:a.challenge,password:'weak'},'guest-a'),{code:'INVALID_REGISTRATION'});
    const data=open(JSON.parse(Buffer.from(a.challenge,'base64url').toString()),options.cookieKey,'guest-a','registration-email') as {expires:number};
    data.expires=Date.now()-1;
    const expired=Buffer.from(JSON.stringify(seal(data,options.cookieKey,'guest-a','registration-email','registration-v1'))).toString('base64url');
    await assert.rejects(accounts.register({...credentials,challenge:expired},'guest-a'),{code:'VERIFICATION_EXPIRED'});
    assert.equal(users.size,0);assert.equal(requests.filter(r=>r.path==='/auth/v1/signup').length,0);
    await accounts.register({...credentials,challenge:a.challenge},'guest-a');
    await assert.rejects(accounts.register({...credentials,challenge:a.challenge},'guest-a'),{code:'INVALID_VERIFICATION'});assert.equal(users.size,1);
    const duplicate=await accounts.registrationCode('other@example.invalid','guest-a');
    await assert.rejects(accounts.register({...credentials,challenge:duplicate.challenge},'guest-a'),{code:'ACCOUNT_EXISTS'});assert.equal(users.size,1);
  }finally{await db.close();}
});
test('图片验证码：供应商要求时展示并验证，不能跳过或借用他人图片证明',async()=>{
  const {db,accounts,requireCaptcha}=await fixture();
  try{
    requireCaptcha();await assert.rejects(accounts.registrationCode('a@example.invalid','guest-a'),{code:'CAPTCHA_REQUIRED'});
    const captcha=await accounts.captcha('guest-a');assert.match(captcha.image,/^data:image\/gif;base64,/);
    await assert.rejects(accounts.registrationCode('a@example.invalid','guest-b',{challenge:captcha.challenge,key:'AB12'}),{code:'VERIFICATION_EXPIRED'});
    await assert.rejects(accounts.registrationCode('a@example.invalid','guest-a',{challenge:captcha.challenge,key:'wrong'}),{code:'INVALID_CAPTCHA'});
    assert.ok((await accounts.registrationCode('a@example.invalid','guest-a',{challenge:captcha.challenge,key:'AB12'})).challenge);
    const proof=await accounts.registrationCode('login@example.invalid','guest-login',{challenge:(await accounts.captcha('guest-login')).challenge,key:'AB12'});
    await accounts.register({...credentials,challenge:proof.challenge},'guest-login');
    await assert.rejects(accounts.login(credentials.username,credentials.password),{code:'CAPTCHA_REQUIRED'});
    const login=await accounts.login(credentials.username,credentials.password,{subject:'guest-login',captcha:{challenge:(await accounts.captcha('guest-login')).challenge,key:'AB12'}});
    assert.equal(login.displayName,credentials.username);
  }finally{await db.close();}
});
test('注册API：同源CSRF、严格字段、发送冷却和独立账号会话',async()=>{
  const {db,accounts,users}=await fixture(),app=await createApp({accounts,origin:'https://test.example',environment:'local'});
  try{
    const session=await app.inject('/api/v1/auth/session'),identity=session.json();assert.equal(identity.registrationAvailable,true);
    const headers={cookie:String(session.headers['set-cookie']).split(';')[0],origin:'https://test.example','x-csrf-token':identity.csrfToken};
    assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/registration/code',headers:{...headers,origin:'https://evil.example'},payload:{email:'alice@example.invalid'}})).statusCode,403);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/registration/code',headers,payload:{email:'not-email'}})).statusCode,400);
    const code=await app.inject({method:'POST',url:'/api/v1/auth/registration/code',headers,payload:{email:'alice@example.invalid'}});assert.equal(code.statusCode,200);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/registration/code',headers,payload:{email:'alice@example.invalid'}})).statusCode,429);
    const input={...credentials,challenge:code.json().challenge};
    assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/register',headers,payload:{...input,userId:'victim'}})).statusCode,400);assert.equal(users.size,0);
    const registered=await app.inject({method:'POST',url:'/api/v1/auth/register',headers,payload:input});assert.equal(registered.statusCode,200);assert.match(String(registered.headers['set-cookie']),/HttpOnly; Secure; SameSite=Strict/);
    const cookie=`${headers.cookie}; ${String(registered.headers['set-cookie']).split(';')[0]}`;
    const current=(await app.inject({url:'/api/v1/auth/session',headers:{cookie}})).json();assert.equal(current.identity,'account');assert.equal(current.mustChangePassword,false);
    assert.equal((await app.inject({url:'/api/v1/account/state',headers:{cookie}})).statusCode,200);
  }finally{await app.close();await db.close();}
});
test('注册开关关闭不调用邮件接口，已有登录/同步不受开关影响',async()=>{
  const {db,accounts,requests}=await fixture(false),app=await createApp({accounts,origin:'https://test.example',environment:'local'});
  try{
    await assert.rejects(accounts.registrationCode('a@example.invalid','guest-a'),{code:'REGISTRATION_UNAVAILABLE'});assert.equal(requests.length,0);
    assert.ok((await accounts.captcha('guest-a')).image,'login captcha remains usable when only registration is switched off');
    const response=await app.inject('/api/v1/auth/session');assert.equal(response.json().registrationAvailable,false);
    const headers={cookie:String(response.headers['set-cookie']).split(';')[0],origin:'https://test.example','x-csrf-token':response.json().csrfToken};
    assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/register',headers,payload:{...credentials,challenge:'none'}})).statusCode,503);
  }finally{await app.close();await db.close();}
});

test('注册与登录分阶段：上游已建号但会话失败明确告知，未知注册结果不能冒充成功',async()=>{
  const {db,options,users}=await fixture();
  try{
    const pending=new CloudBaseAccounts({...options,fetch:async(input,init)=>String(input).endsWith('/shiwei_session_start')?new Response('{}',{status:503}):options.fetch(input,init)});
    const proof=await pending.registrationCode('partial@example.invalid','guest-partial');
    await assert.rejects(pending.register({...credentials,challenge:proof.challenge},'guest-partial'),{code:'REGISTRATION_LOGIN_PENDING'});
    assert.equal(users.size,1);
    const unknown=new CloudBaseAccounts({...options,fetch:async(input,init)=>String(input).endsWith('/auth/v1/signup')?new Response('{}'):options.fetch(input,init)});
    const next=await unknown.registrationCode('unknown@example.invalid','guest-unknown');
    await assert.rejects(unknown.register({...credentials,username:'other-user',challenge:next.challenge},'guest-unknown'),{code:'REGISTRATION_UNCONFIRMED'});
    assert.equal(users.size,1);
  }finally{await db.close();}
});
