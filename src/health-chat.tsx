import React, { useEffect, useRef, useState } from 'react';
import { sendHealthChat, ApiError } from './api';
import { chatContext, type ChatMessage } from '../shared/health-chat';

export function HealthChat({ apiKey, diseases, configure, expired }: { apiKey: string; diseases: string[]; configure: () => void; expired: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]), [draft, setDraft] = useState(''), [pending, setPending] = useState('');
  const [error, setError] = useState(''), [open, setOpen] = useState(true);
  const request = useRef<AbortController | null>(null), end = useRef<HTMLDivElement>(null), area = useRef<HTMLTextAreaElement>(null);
  const clear = () => { request.current?.abort(); request.current = null; setMessages([]); setPending(''); setDraft(''); setError(''); };
  const cancel = () => { const controller = request.current; request.current = null; controller?.abort(); setDraft(pending); setPending(''); setError(''); };
  useEffect(() => { clear(); return () => request.current?.abort(); }, [apiKey]);
  useEffect(() => { const log = end.current?.parentElement; if (open && log) log.scrollTop = log.scrollHeight; }, [messages, pending, open]);
  const send = async () => {
    const text = draft.trim(); if (!text || !apiKey || request.current) return;
    const controller = new AbortController(); request.current = controller;
    setPending(text); setDraft(''); setError('');
    try {
      const result = await sendHealthChat({ operationId: crypto.randomUUID(), apiKey, diseases, messages: chatContext(messages, text) }, controller.signal);
      if (request.current !== controller) return;
      setMessages(history => [...history, { role: 'user' as const, content: text }, result.message].slice(-40));
    } catch (reason) {
      if (request.current !== controller) return;
      setDraft(text);
      if (!controller.signal.aborted) { setError((reason as Error).message); if (reason instanceof ApiError && reason.code === 'LOGIN_REQUIRED') expired(); }
    } finally { if (request.current === controller) { request.current = null; setPending(''); } }
  };
  return <section className="health-chat panel" aria-label="健康AI对话" tabIndex={-1}>
    <header className="health-chat-heading"><div><span className="eyebrow">HEALTH COMPANION</span><h2>和 AI 聊聊怎么吃</h2><p>DeepSeek · 饮食与烹饪参考</p></div><button aria-expanded={open} aria-controls="health-chat-content" onClick={() => setOpen(!open)}>{open ? '收起对话' : '展开对话'}</button></header>
    <div id="health-chat-content" hidden={!open}>
      <p className="health-chat-note">疾病名称与本次对话将发送至 DeepSeek，使用你的 API 额度。对话仅保留在本页，本站知识库尚未接入。</p>
      <div className="health-chat-tools"><button onClick={configure}>{apiKey ? '更换 API Key' : '填写 API Key'}</button><button onClick={clear} disabled={!messages.length && !pending && !draft}>清空对话</button></div>
      <div className="health-chat-messages" role="log" aria-label="对话消息" aria-live="polite" aria-relevant="additions text">
        {!messages.length && !pending && <div className="health-chat-empty"><p>说说你关心的食材或做法吧。</p><div className="health-chat-prompts">{['哪些食材适合我优先选择？', '煎、炸、蒸、煮会怎样改变食材成分？'].map(text => <button key={text} onClick={() => { setDraft(text); area.current?.focus(); }}>{text}</button>)}</div></div>}
        {messages.map((message, i) => <div className={`health-chat-message ${message.role}`} key={i}><strong>{message.role === 'user' ? '我' : 'AI'}</strong><p>{message.content}</p></div>)}
        {pending && <><div className="health-chat-message user"><strong>我</strong><p>{pending}</p></div><p role="status" className="health-chat-wait">AI 正在思考…</p></>}
        <div ref={end}/>
      </div>
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
