import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ApiError, changeAccountPassword, loginAccount, logout, registerAccount, registrationCode, registrationCaptcha } from './api';
import { accountState, initializeAccount, subscribeAccount, syncAccount } from './account-store';
import { readValue, setStorageOwner, writeValue, STORAGE_KEY } from './storage';
import { validateMeal } from './meal-validator.js';
import type { ContentSnapshot } from '../shared/content';
import { validEmail, validUsername, validNewPassword, type CaptchaImage } from '../shared/registration';
import { personalSettings } from '../shared/account';

export function AccountBanner(){
  const state=useSyncExternalStore(subscribeAccount,accountState);
  return ['review','error'].includes(state.status)&&state.session?.identity==='account'?<aside className="account-sync-banner" role="status">{state.message} <a href="/?settings=1">查看账户同步</a></aside>:null;
}
export function AccountControls({catalog,onModeChange}:{catalog?:ContentSnapshot;onModeChange?:(mode:'login'|'register')=>void}){
  const state=useSyncExternalStore(subscribeAccount,accountState);
  const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[repeat,setRepeat]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [messageError,setMessageError]=useState(false),[feedbackVersion,setFeedbackVersion]=useState(0);
  const feedbackRef=useRef<HTMLDivElement>(null);
  const formRef=useRef<HTMLFormElement>(null),runningRef=useRef(false);
  const showMessage=(text:string,error=false)=>{setMessage(text);setMessageError(error);setFeedbackVersion(version=>version+1);};
  useEffect(()=>{if(message){feedbackRef.current?.focus({preventScroll:true});feedbackRef.current?.scrollIntoView({block:'nearest'});}},[message,feedbackVersion]);
  useEffect(()=>{
    const outcome=new URLSearchParams(location.search).get('auth');
    if(state.session?.identity==='account'&&['registered','logged-in'].includes(outcome??'')){
      showMessage(outcome==='registered'?'注册成功，已登录。':'登录成功。');
      history.replaceState({},'','/?settings=1');
    }
  },[state.session?.identity]);
  const [passwordOpen,setPasswordOpen]=useState(false);
  const [authMode,setAuthMode]=useState<'login'|'register'>('login'),[email,setEmail]=useState(''),[code,setCode]=useState(''),[challenge,setChallenge]=useState('');
  const switchMode=()=>{const next=authMode==='login'?'register':'login';setAuthMode(next);onModeChange?.(next);setMessage('');setPassword('');setRepeat('');setCaptcha(null);};
  const [captcha,setCaptcha]=useState<CaptchaImage|null>(null),[captchaKey,setCaptchaKey]=useState(''),[resendAt,setResendAt]=useState(0),[remaining,setRemaining]=useState(0);
  useEffect(()=>{const update=()=>setRemaining(Math.max(0,Math.ceil((resendAt-Date.now())/1000)));update();const timer=setInterval(update,1000);return()=>clearInterval(timer);},[resendAt]);
  const run=async(action:()=>Promise<void>,clearPasswords=true)=>{
    if(runningRef.current)return;runningRef.current=true;
    setBusy(true);setMessage('');setMessageError(false);
    try{await action();if(clearPasswords){setPassword('');setNewPassword('');setRepeat('');}}
    catch(error){showMessage((error as Error).message,true);}
    finally{runningRef.current=false;setBusy(false);}
  };
  const signIn=async(register:boolean,input:{username:string;password:string;repeat:string;code:string;captchaKey:string})=>{
    const {username,password,repeat,code,captchaKey}=input;
    if(register){
      if(!validUsername(username))throw Error('用户名须为5～24位，包含字母，可用数字、点、下划线或短横线');
      if(!validNewPassword(password))throw Error('密码须为8～32位，包含大小写字母、数字和符号');
      if(password!==repeat)throw Error('两次密码不一致');
      if(!challenge||!/^\d{6}$/.test(code))throw Error('请先获取并填写六位邮箱验证码');
    }
    else if(!username.trim()||password.length<8)throw Error('请输入用户名和至少8位密码');
    const guest=accountState().local;
    const draft=readValue(STORAGE_KEY);
    let session;
    try{session=register?await registerAccount({username,password,code,challenge}):await loginAccount(username,password,captcha?{challenge:captcha.challenge,key:captchaKey}:undefined);}
    catch(error){
      if(error instanceof ApiError&&['CAPTCHA_REQUIRED','INVALID_CAPTCHA'].includes(error.code)){setCaptcha(await registrationCaptcha());setCaptchaKey('');}
      throw error;
    }
    if(session.identity!=='account'||!session.userId)throw Error('未能建立登录会话，请检查浏览器是否允许本站保存Cookie，然后重试');
    setStorageOwner(session.userId);
    if(validateMeal(draft)&&readValue(STORAGE_KEY)===null)writeValue(STORAGE_KEY,draft);
    const imported={...guest,defaults:validateMeal(draft)?personalSettings(draft):guest.defaults};
    await initializeAccount(catalog,session,imported);
    history.replaceState({},'','/?settings=1');
    showMessage(register?'注册成功，已登录。':'登录成功。');
  };
  const sendCode=async()=>{
    const email=String(new FormData(formRef.current!).get('email')??'').trim();setEmail(email);
    if(!validEmail(email))throw Error('请输入有效的邮箱地址');
    try{
      const response=await registrationCode(email.trim(),captcha?{challenge:captcha.challenge,key:captchaKey}:undefined);
      setChallenge(response.challenge);setCode('');setResendAt(Date.now()+60000);setCaptcha(null);setCaptchaKey('');setMessage(`验证码已发送，请检查邮箱，有效期${Math.ceil(response.expiresIn/60)}分钟`);
    }catch(error){
      if(error instanceof ApiError&&['CAPTCHA_REQUIRED','INVALID_CAPTCHA'].includes(error.code)){setCaptcha(await registrationCaptcha());setCaptchaKey('');}
      throw error;
    }
  };
  const signOut=async()=>{
    const session=await logout();setStorageOwner(null);await initializeAccount(catalog,session);window.dispatchEvent(new Event('shiwei:account-applied'));history.replaceState({},'','/?settings=1');setMessage('');setAuthMode('login');onModeChange?.('login');
  };
  const captchaControls=captcha&&<div className="registration-captcha"><img src={captcha.image} alt="图片验证码"/><button type="button" disabled={busy} onClick={()=>void run(async()=>{setCaptcha(await registrationCaptcha());setCaptchaKey('');},false)}>换一张</button><label>图片验证码<input name="captcha-key" value={captchaKey} maxLength={16} autoComplete="off" onChange={e=>setCaptchaKey(e.target.value)}/></label></div>;
  const feedback=message&&<div className={`account-feedback${messageError?' account-feedback-error':''}`} ref={feedbackRef} role={messageError?'alert':'status'} tabIndex={-1}>{message}</div>;
  if(state.session?.identity!=='account')return <form ref={formRef} name={`shiwei-${authMode}`} className="account-form" noValidate onSubmit={e=>{
    e.preventDefault();if(runningRef.current)return;
    // Password managers can fill the DOM without firing React change events.
    // Snapshot the visible form BEFORE busy-state renders, then mirror it so
    // validation/network failures keep the same inputs the user submitted.
    const data=new FormData(e.currentTarget),input={username:String(data.get('username')??'').trim(),password:String(data.get('password')??''),repeat:String(data.get('confirm-password')??''),code:String(data.get('verification-code')??''),captchaKey:String(data.get('captcha-key')??'')};
    setUsername(input.username);setPassword(input.password);setRepeat(input.repeat);setCode(input.code);setCaptchaKey(input.captchaKey);setEmail(String(data.get('email')??''));
    void run(()=>signIn(authMode==='register',input));
  }}>
    <p>{authMode==='register'?'创建账号，保存个人设置和收藏。':'登录后自动恢复个人设置和收藏。'}</p>
    {feedback}
    <label>用户名<input name="username" autoComplete="username" value={username} minLength={authMode==='register'?5:2} maxLength={authMode==='register'?24:48} onChange={e=>setUsername(e.target.value)} required/></label>
    {authMode==='register'&&<><label>邮箱<input name="email" type="email" autoComplete="email" value={email} maxLength={254} onChange={e=>{setEmail(e.target.value);setChallenge('');setCode('');}} required/></label><p className="small">邮箱用于验证账号归属。无需邀请码。</p>
      <div className="registration-code"><label>邮箱验证码<input name="verification-code" value={code} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} onChange={e=>setCode(e.target.value)} required/></label><button type="button" disabled={busy||remaining>0||Boolean(captcha&&!captchaKey)} onClick={()=>void run(sendCode,false)}>{remaining>0?`${remaining}秒后重发`:'获取验证码'}</button></div></>}
    {captchaControls}<label>密码<input name="password" type="password" autoComplete={authMode==='register'?'new-password':'current-password'} value={password} minLength={8} maxLength={authMode==='register'?32:64} onChange={e=>setPassword(e.target.value)} required/></label>
    {authMode==='register'&&<><label>确认密码<input name="confirm-password" type="password" autoComplete="new-password" value={repeat} minLength={8} maxLength={32} onChange={e=>setRepeat(e.target.value)} required/></label><p className="small">密码8～32位，包含大小写字母、数字和符号。</p></>}
    <button type="submit" className="primary account-submit" disabled={busy}>{busy?(authMode==='register'?'正在注册…':'正在登录…'):authMode==='register'?'注册并登录':'登录'}</button>
    {state.session?.registrationAvailable&&<p className="account-mode-switch">{authMode==='login'?'还没有账号？':'已有账号？'}<button type="button" disabled={busy} onClick={switchMode}>{authMode==='login'?'注册账号':'返回登录'}</button></p>}
  </form>;
  return <div className="account-controls"><p className="account-state">已登录 · {state.session.displayName}</p>
    {feedback}
    {state.session.mustChangePassword||passwordOpen?<form className="account-form" onSubmit={e=>{e.preventDefault();void run(async()=>{if(!validNewPassword(newPassword))throw Error("新密码须为8～32位，包含大小写字母、数字和符号");if(newPassword!==repeat)throw Error('两次新密码不一致');await changeAccountPassword(password,newPassword);setMessage('密码已修改，请用新密码重新登录');await initializeAccount();});}}><p>{state.session.mustChangePassword?'首次登录请修改初始密码，再同步个人资料。':'修改密码后需要重新登录。'}</p><label>{state.session.mustChangePassword?'初始密码':'当前密码'}<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><label>新密码<input type="password" autoComplete="new-password" value={newPassword} minLength={8} maxLength={32} onChange={e=>setNewPassword(e.target.value)} required/></label><label>再次输入新密码<input type="password" autoComplete="new-password" value={repeat} onChange={e=>setRepeat(e.target.value)} required/></label><p className="small">8～32位，包含大小写字母、数字和符号。</p><button className="primary" disabled={busy}>修改密码</button></form>:<>
      {state.message&&<p role="status">{state.message}</p>}
      {state.status==='error'&&<button disabled={busy} onClick={()=>void run(async()=>{await initializeAccount();await syncAccount();})}>重试同步</button>}
      <button disabled={busy} onClick={()=>setPasswordOpen(true)}>修改密码</button>
    </>}
    <button disabled={busy||state.status==='saving'} onClick={()=>void run(signOut)}>退出登录</button>
  </div>;
}
