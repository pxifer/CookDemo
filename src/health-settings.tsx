import React from 'react';
import type { Meal } from '../shared/types';
import type { SessionInfo } from '../shared/session';
import { diseaseAliases } from '../shared/catalog';

export function HealthSettings({ meal, session, diseaseText, setDiseaseText, edit, enable, close, message }: {
  meal: Meal; session: SessionInfo | null; diseaseText: string; setDiseaseText: (text: string) => void;
  edit: (changes: Partial<Meal>) => unknown; enable: () => void; close: () => void; message: string;
}) {
  const model = session?.healthModelAvailable === true;
  if (!model && !session?.localTestFeatures) return <><p>健康推荐暂不可用。你仍可使用普通推荐，并分别设置过敏和忌口。</p><button className="primary" onClick={() => { edit({ health: false }); close(); }}>使用普通模式</button></>;
  const toggle = (name: string) => {
    if (meal.diseases.includes(name)) edit({ diseases: meal.diseases.filter(d => d !== name) });
    else if (meal.diseases.length < 20) edit({ diseases: [...meal.diseases, name] });
  };
  return <>
    <p className="health-test-note">{model ? `开启后，生成时会将疾病名称发送给${session.healthModelProvider ?? '已配置的模型服务'}整理检索词。健康证据与规则尚未接通，暂不提供健康菜谱。` : '本机测试：可体验设置与推荐流程，当前菜谱尚未按疾病规则筛选。'}</p>
    <label htmlFor="disease-text">需要关注的疾病名称</label>
    <input id="disease-text" maxLength={100} value={diseaseText} onChange={e => setDiseaseText(e.target.value)} placeholder="输入名称后添加"/>
    <div className="chips">{['高血压', '糖尿病', '痛风'].map(d => <button key={d} aria-pressed={meal.diseases.includes(d)} onClick={() => toggle(d)}>{d}</button>)}</div>
    <button disabled={!diseaseText.trim() || meal.diseases.length >= 20} onClick={() => { const text = diseaseText.trim(), name = diseaseAliases[text] ?? text; if (name && !meal.diseases.includes(name)) toggle(name); setDiseaseText(''); }}>添加名称</button>
    <div className="health-names">{meal.diseases.map(d => <button key={d} aria-label={`移除疾病 ${d}`} onClick={() => toggle(d)}>{d} ×</button>)}</div>
    <p className="small subtle">名称识别不表示该疾病已获支持。</p>
    <button className="primary" disabled={model && !meal.diseases.length} onClick={enable}>{model ? session?.identity === 'guest' ? '登录后开启健康模式' : '开启健康模式' : session?.identity === 'local-test' ? '开启健康模式测试' : '登录并开启健康模式测试'}</button>
    {meal.health && <button onClick={() => { edit({ health: false }); close(); }}>关闭健康模式</button>}
    {message && <p role="status">{message}</p>}
  </>;
}
