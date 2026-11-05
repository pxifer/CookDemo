import React,{useRef,useState} from 'react';
import { eraseAccount } from './api';
import { initializeAccount } from './account-store';
import { forgetAccountStorage } from './storage';
export function AccountErasure({userId,onResult}:{userId:string;onResult:(message:string)=>void}){
  const [open,setOpen]=useState(false),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const running=useRef(false);
  return <section className="account-erasure"><button type="button" disabled={busy} onClick={()=>setOpen(!open)}>注销账号</button>
    {open&&<form className="account-form" onSubmit={event=>{event.preventDefault();if(running.current)return;running.current=true;setBusy(true);setMessage('');void eraseAccount(password,confirmation).then(async result=>{setPassword('');setConfirmation('');const text=result.state==='completed'?`账号已注销。处理编号：${result.operationId}`:`注销需要继续核对，请保留处理编号：${result.operationId}。这不代表所有步骤已完成。`;setMessage(text);onResult(text);forgetAccountStorage(userId);await initializeAccount();window.dispatchEvent(new Event('shiwei:account-applied'));}).catch(error=>setMessage((error as Error).message)).finally(()=>{running.current=false;setBusy(false);});}}><p>注销会撤销登录并清除账户中的个人设置、健康档案、模型Key和收藏。请先确认需要保留的内容。</p><label>当前密码<input type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required/></label><label>输入“注销账号”确认<input value={confirmation} onChange={event=>setConfirmation(event.target.value)} required/></label><button className="danger" disabled={busy||confirmation!=='注销账号'}>确认注销账号</button></form>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
