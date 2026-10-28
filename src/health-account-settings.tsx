import React,{useState} from 'react';
import { saveHealthApiKey } from './account-store';
import type { AiFoodChoices, HealthProfile } from '../shared/health-chat';
import { healthTopics, removeHealthTopic, withHealthTopics } from '../shared/health-topics';
export function HealthAccountSettings({configured,last4,profile,onProfileChange,preferences,isMatchable}:{configured:boolean;last4?:string;profile?:HealthProfile;onProfileChange:(profile:HealthProfile|undefined)=>void;preferences?:AiFoodChoices;isMatchable:(name:string)=>boolean}){
  const [key,setKey]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false);
  const save=async(value:string|null)=>{if(busy)return;setBusy(true);setMessage('');setError(false);try{await saveHealthApiKey(value);setKey('');setMessage(value?'Key 已保存，下次登录可直接使用。':'Key 已清空，健康对话已停用。');}catch(reason){setError(true);setMessage((reason as Error).message);}finally{setBusy(false);}};
  return <div className="health-account-settings"><section aria-label="模型连接"><h3>AI 模型连接</h3><p className="key-status">{configured?`DeepSeek Key 已保存 · Key 尾号 ${last4}`:'尚未配置 DeepSeek Key'}</p>
    <label htmlFor="account-health-key">DeepSeek API Key</label><input id="account-health-key" type="password" autoComplete="off" spellCheck={false} maxLength={253} value={key} onChange={event=>setKey(event.target.value.trim())} placeholder={configured?'输入新 Key 可更换':'sk-…'}/>
    <p className="small subtle">加密保存在你的账户中，登录后自动使用。发送消息或请 AI 搭配时使用你的 DeepSeek 额度。</p>
    <div className="actions"><button className="primary" disabled={busy||!/^sk-[A-Za-z0-9_-]{16,250}$/.test(key)} onClick={()=>void save(key)}>{busy?'正在保存…':configured?'更换 Key':'保存 Key'}</button>{configured&&<button disabled={busy} onClick={()=>void save(null)}>清空 Key</button>}</div>
    {message&&<p role={error?'alert':'status'}>{message}</p>}
  </section>
  <section aria-label="健康档案"><h3>健康与饮食目标</h3>{profile?<><p className="small subtle">来自你在对话中提供的信息，可随时移除。AI 不会据此作出诊断。</p>
    {(['conditions','goals'] as const).map(kind=>profile[kind].length>0&&<div key={kind}><strong>{kind==='conditions'?'健康关注':'饮食目标'}</strong><div className="chips">{profile[kind].map(name=><button key={name} aria-label={`移除${kind==='conditions'?'健康关注':'饮食目标'} ${name}`} onClick={()=>onProfileChange(removeHealthTopic(profile,kind,name,preferences))}>{name} ×</button>)}</div></div>)}
    {profile.notes&&<p>{profile.notes}</p>}<p className="small subtle">每项健康关注或目标单独保存建议，移除时会一并撤销它带来的选择。</p><button className="clear-health-profile" onClick={()=>onProfileChange(undefined)}>清除健康档案与AI建议</button>
  </>:<p className="small subtle">与 AI 说明健康情况或饮食目标后，会自动整理保存在这里。</p>}</section>
  <section aria-label="已接受的AI食材选择"><h3>已接受的食材选择</h3><p className="small subtle">随账号保存，AI 会读取；仅在健康模式使用。待匹配项暂不参与筛选。</p>
    {profile?healthTopics(profile,preferences).map(topic=><section key={topic.id} aria-label={`${topic.name}已接受的选择`}><h4>{topic.name}</h4>{(['preferred','limited','excluded'] as const).map(kind=><div className={`saved-ai-group saved-${kind}`} key={kind}><strong>{kind==='preferred'?'推荐':kind==='limited'?'少选':'避开'}</strong>{topic.accepted[kind].length?<div className="chips">{topic.accepted[kind].map(name=><button key={name} aria-label={`移除${topic.name}已接受${kind==='preferred'?'推荐':kind==='limited'?'少选':'避开'} ${name}`} onClick={()=>onProfileChange(withHealthTopics(profile,healthTopics(profile,preferences).map(item=>item.id===topic.id?{...item,accepted:{...item.accepted,[kind]:item.accepted[kind].filter(food=>food!==name)}}:item)))}>{name}{!isMatchable(name)?'（待匹配）':''} ×</button>)}</div>:<p className="small subtle">尚未接受此类建议</p>}</div>)}</section>):<p className="small subtle">暂无已接受的选择。</p>}
  </section></div>;
}
