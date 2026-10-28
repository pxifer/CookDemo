import type { Recipe } from '../shared/types';
import React, { useEffect, useRef, useState } from 'react';
import { sendHealthChat, ApiError } from './api';
import { chatContext, type ChatMessage, type AiFoodChoices, type DietAssessment, type HealthChatRequest, type ProviderInvocation, type HealthProfile } from '../shared/health-chat';
import { ChatMarkdown } from './chat-markdown';
import { acceptAccountSnapshot, flushHealthSettings } from './account-store';
import { AiFoodList, AiFoodSuggestions } from './ai-food-selection';

export function HealthChat({ configured, last4, profile, initialAssessment, diseases, configure, expired, mealContext, choices, onApply, savedFoods, onSave, accepted, onAccept, recipes, onOpenRecipe }: { configured:boolean;last4?:string;profile?:HealthProfile;initialAssessment?:DietAssessment; diseases: string[]; configure: () => void; expired: () => void;mealContext?:HealthChatRequest['mealContext'];choices?:AiFoodChoices;onApply:(choices:AiFoodChoices,recommend:boolean)=>boolean;savedFoods:string[];onSave:(foods:string[])=>boolean;accepted?:AiFoodChoices;onAccept:(kind:keyof AiFoodChoices,names:string[],topicId?:string)=>boolean;recipes:Recipe[];onOpenRecipe:(recipeId:string,variantId:string)=>void }) {
  const hasProfile=Boolean(profile&&(profile.conditions.length||profile.goals.length||profile.notes||profile.suggestions.length));
  const [messages, setMessages] = useState<(ChatMessage&{invocation?:ProviderInvocation})[]>([]), [draft, setDraft] = useState(''), [pending, setPending] = useState('');
  const [assessment,setAssessment]=useState<DietAssessment|null>(initialAssessment??null);
  const [error, setError] = useState(''), [open, setOpen] = useState(true);
  const request = useRef<AbortController | null>(null), end = useRef<HTMLDivElement>(null), area = useRef<HTMLTextAreaElement>(null);
  const contextStart=useRef(0),previousTopics=useRef<string[]>([...(profile?.conditions??[]),...(profile?.goals??[])]);
  const clear = () => { request.current?.abort(); request.current = null; contextStart.current=0;setMessages([]); setAssessment(initialAssessment??null); setPending(''); setDraft(''); setError(''); };
  const cancel = () => { const controller = request.current; request.current = null; controller?.abort(); setDraft(pending); setPending(''); setError(''); };
  useEffect(() => { clear(); return () => request.current?.abort(); }, [configured,last4]);
  useEffect(()=>{setAssessment(initialAssessment??null);},[initialAssessment]);
  useEffect(()=>{
    const current=[...(profile?.conditions??[]),...(profile?.goals??[])];
    if(previousTopics.current.some(name=>!current.includes(name))){request.current?.abort();request.current=null;if(pending)setDraft(pending);setPending('');contextStart.current=messages.length;setError('');}
    previousTopics.current=current;
  },[profile]);
  useEffect(() => { const log = end.current?.parentElement; if (open && log) log.scrollTop = log.scrollHeight; }, [messages, pending, open]);
  const send = async () => {
    const text = draft.trim(); if (!text || !configured || request.current) return;
    const controller = new AbortController(); request.current = controller;
    setPending(text); setDraft(''); setError('');
    try {
      await flushHealthSettings();controller.signal.throwIfAborted();
      const result = await sendHealthChat({ operationId: crypto.randomUUID(), diseases:profile?.conditions??[], profile:profile?{conditions:profile.conditions,goals:profile.goals,notes:profile.notes}:undefined, mealContext, messages: chatContext(messages.slice(contextStart.current).map(({role,content})=>({role,content})), text) }, controller.signal);
      if (request.current !== controller) return;
      if(result.accountSnapshot)acceptAccountSnapshot(result.accountSnapshot);
      if(result.saveError)setError(result.saveError);
      setMessages(history => {const next=[...history,{role:'user' as const,content:text},{...result.message,invocation:result.invocation}];contextStart.current=Math.max(0,contextStart.current-Math.max(0,next.length-40));return next.slice(-40);});if(!result.accountSnapshot)setAssessment(result.assessment??null);
    } catch (reason) {
      if (request.current !== controller) return;
      setDraft(text);
      if (!controller.signal.aborted) { setError((reason as Error).message); if (reason instanceof ApiError && reason.code === 'LOGIN_REQUIRED') expired(); }
    } finally { if (request.current === controller) { request.current = null; setPending(''); } }
  };
  return <section className="health-chat panel" aria-label="健康AI对话" tabIndex={-1}>
    <header className="health-chat-heading"><div><span className="eyebrow">饮食助手</span><h2>这一餐，吃得更合适</h2><p>说说健康情况或饮食目标，我来帮你选食材。</p></div><button aria-expanded={open} aria-controls="health-chat-content" onClick={() => setOpen(!open)}>{open ? '收起对话' : '展开对话'}</button></header>
    <details className="health-profile-summary"><summary>我的饮食档案 <span>{profile?[...profile.conditions,...profile.goals].join(' · ')||'已保存':savedFoods.length?`${savedFoods.length} 项排除`:'尚未整理'}</span></summary>{accepted&&<p className="small subtle">已接受：推荐 {accepted.preferred.length} 项 · 少选 {accepted.limited.length} 项 · 避开 {accepted.excluded.length} 项</p>}<AiFoodList choices={choices} onApply={onApply} savedFoods={savedFoods} onSave={onSave}/><button onClick={configure}>管理健康档案</button></details>
    <div id="health-chat-content" hidden={!open}>
      <details className="health-chat-note"><summary>关于这次对话</summary><p>发送时会将健康资料、对话和本餐设置提供给 DeepSeek，使用你的模型额度。健康情况、目标及食材建议会加密保存在账户；完整对话不保存。建议仅作饮食参考，本站RAG尚未接入。</p></details>
      <div className="health-chat-tools"><button onClick={configure}>模型设置</button><button onClick={clear} disabled={!messages.length && !pending && !draft}>清空本页对话</button></div>
      <div className={`health-chat-messages${!messages.length&&!pending&&hasProfile?' is-restored':''}`} role="log" aria-label="对话消息" aria-live="polite" aria-relevant="additions text">
        {!messages.length&&!pending&&hasProfile&&!profile?.suggestions.length&&<p className="small subtle">已保留你的健康关注与目标。可以补充情况，或请 AI 按当前档案重新整理食材建议。</p>}
        {!messages.length && !pending && !hasProfile && <div className="health-chat-empty"><h3>你希望饮食帮你改善什么？</h3><p>可以说说已知疾病、医生的饮食提醒，或增肌、瘦身等目标。不清楚的部分可以跳过。</p><div className="health-chat-prompts">{['我想增肌，帮我选择食材', '我想瘦身，帮我选择食材', '按我已填的疾病和食材，帮我看看怎么选择'].map(text => <button key={text} onClick={() => { setDraft(text); area.current?.focus(); }}>{text}</button>)}</div></div>}
        {messages.map((message, i) => <div className={`health-chat-message ${message.role}`} key={i}><strong>{message.role === 'user' ? '我' : 'AI'}</strong>{message.role==='assistant'?<ChatMarkdown text={message.content}/>:<p>{message.content}</p>}
        </div>)}
        {pending && <><div className="health-chat-message user"><strong>我</strong><p>{pending}</p></div><p role="status" className="health-chat-wait">AI 正在思考…</p></>}
        <div ref={end}/>
      </div>

      {error && <p role="alert" className="health-chat-error">{error}</p>}
      {!configured && <p role="status">请先到个人设置填写 DeepSeek Key，再开始对话。</p>}
      <form className="health-chat-compose" onSubmit={event => { event.preventDefault(); void send(); }}>
        <label className="sr-only" htmlFor="health-chat-message">给AI的消息</label>
        <textarea id="health-chat-message" ref={area} maxLength={2000} value={draft} disabled={Boolean(pending)} onChange={event => setDraft(event.target.value)} placeholder="例如：我想增肌，平时更适合选哪些食材？" onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}/>
        <div><span>Enter 发送 · Shift+Enter 换行</span>{pending ? <button key="cancel" type="button" onClick={event => { event.preventDefault(); cancel(); }}>取消回复</button> : <button key="send" className="primary" type="submit" disabled={!configured || !draft.trim()}>发送消息</button>}</div>
      </form>
      {assessment&&<AiFoodSuggestions assessment={assessment} choices={choices} onApply={(value,recommend)=>{const success=onApply(value,recommend);if(success&&recommend)setOpen(false);return success;}} savedFoods={savedFoods} onSave={onSave} accepted={accepted} onAccept={onAccept} recipes={recipes} onOpenRecipe={onOpenRecipe}/>}
    </div>
  </section>;
}
