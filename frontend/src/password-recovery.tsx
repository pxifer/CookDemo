import React,{useRef,useState} from 'react';
import { ApiError,passwordRecoveryCode,recoverAccountPassword,registrationCaptcha } from './api';
import { validEmail,validNewPassword,type CaptchaImage } from '../../shared/registration';
export function PasswordRecovery({back}:{back:()=>void}){
  const [email,setEmail]=useState(''),[challenge,setChallenge]=useState(''),[code,setCode]=useState(''),[password,setPassword]=useState(''),[repeat,setRepeat]=useState('');
  const [captcha,setCaptcha]=useState<CaptchaImage|null>(null),[captchaKey,setCaptchaKey]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[complete,setComplete]=useState(false),[nextSend,setNextSend]=useState(0);
  const running=useRef(false);
  const run=async(action:()=>Promise<void>)=>{if(running.current)return;running.current=true;setBusy(true);setMessage('');try{await action();}catch(error){setMessage((error as Error).message);if(error instanceof ApiError&&['CAPTCHA_REQUIRED','INVALID_CAPTCHA'].includes(error.code)){try{setCaptcha(await registrationCaptcha());setCaptchaKey('');}catch{setMessage('图片验证暂不可用，请稍后重试');}}}finally{running.current=false;setBusy(false);}};
  return <section className="account-form" aria-label="找回密码"><h3>找回密码</h3><p>使用注册时验证的邮箱重置密码。重置完成后需要重新登录。</p>
    {message&&<p role="status">{message}</p>}
    {!complete&&<><label>注册邮箱<input type="email" autoComplete="email" value={email} disabled={busy} onChange={event=>{setEmail(event.target.value);setChallenge('');setCode('');}}/></label>
    {captcha&&<><img src={captcha.image} alt="图片验证码"/><label>图片验证码<input value={captchaKey} maxLength={16} onChange={event=>setCaptchaKey(event.target.value)}/></label></>}
    <button type="button" disabled={busy} onClick={()=>void run(async()=>{if(!validEmail(email))throw Error('请输入有效邮箱');if(Date.now()<nextSend)throw Error('请60秒后再获取验证码');const result=await passwordRecoveryCode(email.trim().toLowerCase(),captcha?{challenge:captcha.challenge,key:captchaKey}:undefined);setChallenge(result.challenge);setNextSend(Date.now()+60000);setMessage('若该邮箱可用于找回，验证码将发送至邮箱，请检查收件箱。');})}>获取找回验证码</button>
    {challenge&&<form onSubmit={event=>{event.preventDefault();void run(async()=>{if(!/^\d{6}$/.test(code)||!validNewPassword(password))throw Error('请填写六位验证码及8～32位大小写字母、数字、符号组合的新密码');if(password!==repeat)throw Error('两次密码不一致');await recoverAccountPassword(challenge,code,password);setPassword('');setRepeat('');setCode('');setComplete(true);setMessage('密码已重置，会话已退出，请使用新密码登录。');});}}><label>邮箱验证码<input value={code} maxLength={6} inputMode="numeric" autoComplete="one-time-code" onChange={event=>setCode(event.target.value)}/></label><label>新密码<input type="password" autoComplete="new-password" value={password} maxLength={32} onChange={event=>setPassword(event.target.value)}/></label><label>确认新密码<input type="password" autoComplete="new-password" value={repeat} maxLength={32} onChange={event=>setRepeat(event.target.value)}/></label><button type="submit" className="primary" disabled={busy}>重置密码</button></form>}</>}
    <button type="button" disabled={busy} onClick={back}>返回登录</button>
  </section>;
}
