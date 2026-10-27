import React,{useState} from 'react';
import { saveHealthApiKey } from './account-store';
import type { HealthProfile } from '../shared/health-chat';
export function HealthAccountSettings({configured,last4,profile,onProfileChange}:{configured:boolean;last4?:string;profile?:HealthProfile;onProfileChange:(profile:HealthProfile|undefined)=>void}){
  const [key,setKey]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false);
  const save=async(value:string|null)=>{if(busy)return;setBusy(true);setMessage('');setError(false);try{await saveHealthApiKey(value);setKey('');setMessage(value?'Key 已保存，下次登录可直接使用。':'Key 已清空，健康对话已停用。');}catch(reason){setError(true);setMessage((reason as Error).message);}finally{setBusy(false);}};
  return <div className="health-account-settings"><section aria-label="模型连接"><h3>AI 模型连接</h3><p className="key-status">{configured?`DeepSeek Key 已保存 · Key 尾号 ${last4}`:'尚未配置 DeepSeek Key'}</p>
    <label htmlFor="account-health-key">DeepSeek API Key</label><input id="account-health-key" type="password" autoComplete="off" spellCheck={false} maxLength={253} value={key} onChange={event=>setKey(event.target.value.trim())} placeholder={configured?'输入新 Key 可更换':'sk-…'}/>
    <p className="small subtle">加密保存在你的账户中，登录后自动使用。只有发送消息才调用模型，费用使用你的 DeepSeek 额度。</p>
    <div className="actions"><button className="primary" disabled={busy||!/^sk-[A-Za-z0-9_-]{16,250}$/.test(key)} onClick={()=>void save(key)}>{busy?'正在保存…':configured?'更换 Key':'保存 Key'}</button>{configured&&<button disabled={busy} onClick={()=>void save(null)}>清空 Key</button>}</div>
    {message&&<p role={error?'alert':'status'}>{message}</p>}
  </section>
  <section aria-label="健康档案"><h3>健康与饮食目标</h3>{profile?<><p className="small subtle">来自你在对话中提供的信息，可随时移除。AI 不会据此作出诊断。</p>
    {(['conditions','goals'] as const).map(kind=>profile[kind].length>0&&<div key={kind}><strong>{kind==='conditions'?'健康关注':'饮食目标'}</strong><div className="chips">{profile[kind].map(name=><button key={name} aria-label={`移除${kind==='conditions'?'健康关注':'饮食目标'} ${name}`} onClick={()=>onProfileChange({...profile,[kind]:profile[kind].filter(item=>item!==name)})}>{name} ×</button>)}</div></div>)}
    {profile.notes&&<p>{profile.notes}</p>}<p className="small subtle">已保存 {profile.suggestions.length} 项食材建议。</p><button onClick={()=>onProfileChange(undefined)}>清除健康档案与AI建议</button>
  </>:<p className="small subtle">与 AI 说明健康情况或饮食目标后，会自动整理保存在这里。</p>}</section></div>;
}
