import React, { useEffect, useState } from 'react';
import type { AiFoodChoices, DietAssessment } from '../shared/health-chat';
import { emptyAiChoices } from '../shared/ai-food-choices';
type Choice='preferred'|'limited'|'excluded'|'reference';
const labels={preferred:'优先选择',limited:'少选',excluded:'AI去疾排除'};

export function AiFoodList({choices,onApply}:{choices?:AiFoodChoices;onApply:(choices:AiFoodChoices,recommend:boolean)=>boolean}){
  const value=choices??emptyAiChoices();
  const remove=(kind:keyof AiFoodChoices,name:string)=>onApply({...value,[kind]:value[kind].filter(item=>item!==name)},false);
  return <aside className="ai-food-list" aria-label="AI去疾">
    <div className="ai-food-title"><strong>AI去疾</strong><small>仅本餐 · 仅健康模式</small></div>
    <p>只排除你同意的食材，不改过敏或忌口。</p>
    {(['excluded','preferred','limited'] as const).map(kind=>value[kind].length>0&&<div className="ai-food-group" key={kind}><span>{labels[kind]}</span><div>{value[kind].map(name=><button key={name} aria-label={`取消${labels[kind]} ${name}`} onClick={()=>remove(kind,name)}>{name} ×</button>)}</div></div>)}
    {!value.excluded.length&&<p className="small subtle">尚未添加 AI去疾 排除项。</p>}
    {(value.excluded.length+value.preferred.length+value.limited.length)>0&&<div className="ai-food-actions"><button onClick={()=>onApply(value,true)}>按当前选择重新搭配</button><button onClick={()=>onApply(emptyAiChoices(),false)}>清空AI选择</button></div>}
  </aside>;
}

export function AiFoodSuggestions({assessment,choices,onApply}:{assessment:DietAssessment;choices?:AiFoodChoices;onApply:(choices:AiFoodChoices,recommend:boolean)=>boolean}){
  const [selection,setSelection]=useState<Record<string,Choice>>({}),[applied,setApplied]=useState(false);
  useEffect(()=>{
    const current=choices??emptyAiChoices();
    setSelection(Object.fromEntries(assessment.suggestions.map(item=>[item.foodName,!item.matchable?'reference':current.excluded.includes(item.foodName)?'excluded':item.direction==='prefer'?'preferred':item.direction==='limit'?'limited':'excluded'])));
    setApplied(false);
  },[assessment]);
  if(!assessment.suggestions.length)return null;
  const selected=assessment.suggestions.filter(item=>item.matchable&&selection[item.foodName]&&selection[item.foodName]!=='reference');
  const apply=(recommend:boolean)=>{
    const next=structuredClone(choices??emptyAiChoices());
    for(const item of selected){for(const kind of ['preferred','limited','excluded'] as const)next[kind]=next[kind].filter(name=>name!==item.foodName);next[selection[item.foodName] as keyof AiFoodChoices].push(item.foodName);}
    if(onApply(next,recommend))setApplied(true);
  };
  return <section className="ai-food-suggestions" aria-label="确认AI食材建议"><h3>是否应用这些食材建议？</h3><p>以下仍是待确认建议。你同意后，才会加入 AI去疾 或推荐偏好。</p>
    <div className="ai-food-proposals">{assessment.suggestions.map(item=><div className="ai-food-proposal" key={item.foodName}><strong>{item.foodName}</strong><p>{item.reason}</p>{item.conditions&&<small>适用条件：{item.conditions}</small>}
      <label><span className="sr-only">{item.foodName}的处理方式</span><select value={selection[item.foodName]??'reference'} disabled={!item.matchable} onChange={event=>{setSelection(value=>({...value,[item.foodName]:event.target.value as Choice}));setApplied(false);}}>
        <option value="reference">仅作参考，不应用</option><option value="preferred">优先推荐</option><option value="limited">少选</option><option value="excluded">同意加入AI去疾排除</option>
      </select></label>{!item.matchable&&<small>目录暂不能匹配此项，保留参考。</small>}</div>)}</div>
    <p className="small subtle">保留现有食材、调料、人数和补买设置；过敏与忌口继续生效。</p>
    <div className="ai-food-actions"><button className="primary" disabled={!selected.length} onClick={()=>apply(true)}>同意选择并重新搭配</button><button disabled={!selected.length} onClick={()=>apply(false)}>同意选择，暂不搭配</button></div>
    {applied&&<p role="status">已应用到本餐，可在 AI去疾 中逐项取消。</p>}
  </section>;
}
