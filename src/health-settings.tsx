import React from 'react';
import type { Meal } from '../shared/types';
import type { SessionInfo } from '../shared/session';
import { diseaseAliases } from '../shared/catalog';

export function HealthSettings({ meal, session, diseaseText, setDiseaseText, edit, enable, close, message, apiKey, setApiKey }: {
  meal: Meal; session: SessionInfo | null; diseaseText: string; setDiseaseText: (text: string) => void;
  edit: (changes: Partial<Meal>) => unknown; enable: () => void; close: () => void; message: string;
  apiKey: string; setApiKey: (key: string) => void;
}) {
  const loggedIn = session?.identity === 'account' || session?.identity === 'local-test';
  if (!loggedIn) return <><p>登录后，填写自己的 DeepSeek API Key，即可开启健康模式，与 AI 聊聊食材、成分和烹调方式。</p><button className="primary" onClick={enable}>登录并设置健康模式</button></>;
  const toggle = (name: string) => {
    if (meal.diseases.includes(name)) edit({ diseases: meal.diseases.filter(d => d !== name) });
    else if (meal.diseases.length < 20) edit({ diseases: [...meal.diseases, name] });
  };
  return <>
    <div className="health-api-settings"><label htmlFor="health-api-key">DeepSeek API Key</label>
      <input id="health-api-key" type="password" autoComplete="off" spellCheck={false} maxLength={253} value={apiKey} onChange={event => setApiKey(event.target.value.trim())} placeholder="sk-…"/>
      <p className="small subtle">仅在当前页面使用，不保存到浏览器或账户。发送消息才会使用你的 DeepSeek 额度，刷新或退出登录后需重新填写。</p>
    </div>
    <label htmlFor="disease-text">需要关注的疾病名称（选填）</label>
    <input id="disease-text" maxLength={100} value={diseaseText} onChange={e => setDiseaseText(e.target.value)} placeholder="输入名称后添加"/>
    <div className="chips">{['高血压', '糖尿病', '痛风'].map(d => <button key={d} aria-pressed={meal.diseases.includes(d)} onClick={() => toggle(d)}>{d}</button>)}</div>
    <button disabled={!diseaseText.trim() || meal.diseases.length >= 20} onClick={() => { const text = diseaseText.trim(), name = diseaseAliases[text] ?? text; if (name && !meal.diseases.includes(name)) toggle(name); setDiseaseText(''); }}>添加名称</button>
    <div className="health-names">{meal.diseases.map(d => <button key={d} aria-label={`移除疾病 ${d}`} onClick={() => toggle(d)}>{d} ×</button>)}</div>
    <p className="small subtle">疾病名称与对话会在发送消息时提供给 DeepSeek。AI 回复仅作饮食参考。</p>
    <button className="primary" onClick={enable}>{meal.health ? '完成设置' : '开启健康模式'}</button>
    {meal.health && <button onClick={() => { edit({ health: false }); close(); }}>关闭健康模式</button>}
    {message && <p role="alert">{message}</p>}
  </>;
}
