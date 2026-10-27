import React, { useEffect, useRef, useState } from 'react';
import { sendHealthChat, ApiError } from './api';
import { chatContext, type ChatMessage, type AiFoodChoices, type DietAssessment, type HealthChatRequest, type ProviderInvocation } from '../shared/health-chat';
import { ChatMarkdown } from './chat-markdown';
import { AiFoodList, AiFoodSuggestions } from './ai-food-selection';

export function HealthChat({ apiKey, diseases, configure, expired, mealContext, choices, onApply }: { apiKey: string; diseases: string[]; configure: () => void; expired: () => void;mealContext?:HealthChatRequest['mealContext'];choices?:AiFoodChoices;onApply:(choices:AiFoodChoices,recommend:boolean)=>boolean }) {
  const [messages, setMessages] = useState<(ChatMessage&{invocation?:ProviderInvocation})[]>([]), [draft, setDraft] = useState(''), [pending, setPending] = useState('');
  const [assessment,setAssessment]=useState<DietAssessment|null>(null);
  const [error, setError] = useState(''), [open, setOpen] = useState(true);
  const request = useRef<AbortController | null>(null), end = useRef<HTMLDivElement>(null), area = useRef<HTMLTextAreaElement>(null);
  const clear = () => { request.current?.abort(); request.current = null; setMessages([]); setAssessment(null); setPending(''); setDraft(''); setError(''); };
  const cancel = () => { const controller = request.current; request.current = null; controller?.abort(); setDraft(pending); setPending(''); setError(''); };
  useEffect(() => { clear(); return () => request.current?.abort(); }, [apiKey]);
  useEffect(() => { const log = end.current?.parentElement; if (open && log) log.scrollTop = log.scrollHeight; }, [messages, pending, open]);
  const send = async () => {
    const text = draft.trim(); if (!text || !apiKey || request.current) return;
    const controller = new AbortController(); request.current = controller;
    setPending(text); setDraft(''); setError('');
    try {
      const result = await sendHealthChat({ operationId: crypto.randomUUID(), apiKey, diseases, mealContext, messages: chatContext(messages.map(({role,content})=>({role,content})), text) }, controller.signal);
      if (request.current !== controller) return;
      setMessages(history => [...history, { role: 'user' as const, content: text }, {...result.message,invocation:result.invocation}].slice(-40));setAssessment(result.assessment??null);
    } catch (reason) {
      if (request.current !== controller) return;
      setDraft(text);
      if (!controller.signal.aborted) { setError((reason as Error).message); if (reason instanceof ApiError && reason.code === 'LOGIN_REQUIRED') expired(); }
    } finally { if (request.current === controller) { request.current = null; setPending(''); } }
  };
  return <section className="health-chat panel" aria-label="健康AI对话" tabIndex={-1}>
    <header className="health-chat-heading"><div><span className="eyebrow">HEALTH COMPANION</span><h2>和 AI 聊聊怎么吃</h2><p>{assessment?.stage==='advice'?'确认食材建议，再按本餐搭配':'先了解健康情况，再选择食材'}</p></div><button aria-expanded={open} aria-controls="health-chat-content" onClick={() => setOpen(!open)}>{open ? '收起对话' : '展开对话'}</button></header>
    <AiFoodList choices={choices} onApply={onApply}/>
    <div id="health-chat-content" hidden={!open}>
      <p className="health-chat-note">对话、疾病名称和本餐已填的食材、调料、饮食限制及补买选择将发送至 DeepSeek，使用你的 API 额度。本站知识库尚未接入，建议由你确认。</p>
      <div className="health-chat-tools"><button onClick={configure}>{apiKey ? '更换 API Key' : '填写 API Key'}</button><button onClick={clear} disabled={!messages.length && !pending && !draft}>清空对话</button></div>
      <div className="health-chat-messages" role="log" aria-label="对话消息" aria-live="polite" aria-relevant="additions text">
        {!messages.length && !pending && <div className="health-chat-empty"><h3>先说说你的健康情况</h3><p>你有哪些已确诊疾病或医生提醒的问题？有没有不舒服、已知食物过敏？没有或不清楚也可以说。</p><div className="health-chat-prompts">{['我想先说明自己的健康情况', '按我已填的疾病和食材，帮我看看怎么选择'].map(text => <button key={text} onClick={() => { setDraft(text); area.current?.focus(); }}>{text}</button>)}</div></div>}
        {messages.map((message, i) => <div className={`health-chat-message ${message.role}`} key={i}><strong>{message.role === 'user' ? '我' : 'AI'}</strong>{message.role==='assistant'?<ChatMarkdown text={message.content}/>:<p>{message.content}</p>}
          {message.invocation&&<details className="chat-call-receipt"><summary>DeepSeek 调用信息 · {message.invocation.totalTokens} tokens</summary><dl><dt>Key 标识</dt><dd>末4位 {apiKey.slice(-4)}</dd><dt>请求ID</dt><dd>{message.invocation.requestId}</dd><dt>模型</dt><dd>{message.invocation.model}</dd><dt>输入 / 输出</dt><dd>{message.invocation.promptTokens} / {message.invocation.completionTokens} tokens</dd><dt>调用时间</dt><dd>{new Date(message.invocation.calledAt).toLocaleString('zh-CN')}</dd></dl><p>来自 DeepSeek 响应，可按填写 Key 所属账号核对用量。</p></details>}
        </div>)}
        {pending && <><div className="health-chat-message user"><strong>我</strong><p>{pending}</p></div><p role="status" className="health-chat-wait">AI 正在思考…</p></>}
        <div ref={end}/>
      </div>
      {assessment&&<AiFoodSuggestions assessment={assessment} choices={choices} onApply={onApply}/>}
      {error && <p role="alert" className="health-chat-error">{error}</p>}
      {!apiKey && <p role="status">先填写 DeepSeek API Key，即可开始对话。</p>}
      <form className="health-chat-compose" onSubmit={event => { event.preventDefault(); void send(); }}>
        <label className="sr-only" htmlFor="health-chat-message">给AI的消息</label>
        <textarea id="health-chat-message" ref={area} maxLength={2000} value={draft} disabled={Boolean(pending)} onChange={event => setDraft(event.target.value)} placeholder="问问食材、成分或烹调方式…" onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}/>
        <div><span>Enter 发送 · Shift+Enter 换行</span>{pending ? <button key="cancel" type="button" onClick={event => { event.preventDefault(); cancel(); }}>取消回复</button> : <button key="send" className="primary" type="submit" disabled={!apiKey || !draft.trim()}>发送消息</button>}</div>
      </form>
    </div>
  </section>;
}
