import React, { useEffect, useState } from 'react';
import type { AiFoodChoices, DietAssessment } from '../shared/health-chat';
import { emptyAiChoices } from '../shared/ai-food-choices';

type Choice='preferred'|'limited'|'excluded'|'reference';
const labels={preferred:'优先选择',limited:'少选',excluded:'本餐排除'};
type Apply=(choices:AiFoodChoices,recommend:boolean)=>boolean;

export function SavedAiFoods({foods,onChange}:{foods:string[];onChange:(foods:string[])=>boolean}){
  return <section className="saved-ai-foods" aria-label="个人AI去疾"><h3>AI去疾</h3><p>经你同意保存的食材排除，仅健康模式生效，不改过敏或忌口。</p>
    {foods.length?<><div className="chips">{foods.map(name=><button key={name} aria-label={`从个人AI去疾移除 ${name}`} onClick={()=>onChange(foods.filter(item=>item!==name))}>{name} ×</button>)}</div><button onClick={()=>onChange([])}>清空个人AI去疾</button></>:<p className="small subtle">尚未保存排除食材。</p>}
  </section>;
}
export function AiFoodList({choices,onApply,savedFoods,onSave}:{choices?:AiFoodChoices;onApply:Apply;savedFoods:string[];onSave:(foods:string[])=>boolean}){
  const value=choices??emptyAiChoices();
  const remove=(kind:keyof AiFoodChoices,name:string)=>onApply({...value,[kind]:value[kind].filter(item=>item!==name)},false);
  return <aside className="ai-food-list" aria-label="AI去疾">
    <SavedAiFoods foods={savedFoods} onChange={onSave}/>
    {(value.excluded.length+value.preferred.length+value.limited.length)>0&&<div className="ai-food-current"><strong>本餐AI选择</strong><small>不自动保存到个人设置</small>
      {(['excluded','preferred','limited'] as const).map(kind=>value[kind].length>0&&<div className="ai-food-group" key={kind}><span>{labels[kind]}</span><div>{value[kind].map(name=><button key={name} aria-label={`取消${labels[kind]} ${name}`} onClick={()=>remove(kind,name)}>{name} ×</button>)}</div></div>)}
      <div className="ai-food-actions"><button onClick={()=>onApply(value,true)}>按当前选择重新搭配</button><button onClick={()=>onApply(emptyAiChoices(),false)}>清空本餐AI选择</button></div>
    </div>}
  </aside>;
}

export function AiFoodSuggestions({assessment,choices,onApply,savedFoods,onSave}:{assessment:DietAssessment;choices?:AiFoodChoices;onApply:Apply;savedFoods:string[];onSave:(foods:string[])=>boolean}){
  const [selection,setSelection]=useState<Record<string,Choice>>({}),[message,setMessage]=useState('');
  useEffect(()=>{const current=choices??emptyAiChoices();setSelection(Object.fromEntries(assessment.suggestions.map(item=>[item.foodName,!item.matchable?'reference':current.excluded.includes(item.foodName)||savedFoods.includes(item.foodName)?'excluded':item.direction==='prefer'?'preferred':item.direction==='limit'?'limited':'excluded'])));setMessage('');},[assessment]);
  if(!assessment.suggestions.length)return null;
  const apply=()=>{const next=structuredClone(choices??emptyAiChoices());for(const item of assessment.suggestions.filter(item=>item.matchable&&selection[item.foodName]!=='reference')){for(const kind of ['preferred','limited','excluded'] as const)next[kind]=next[kind].filter(name=>name!==item.foodName);next[selection[item.foodName] as keyof AiFoodChoices].push(item.foodName);}if(onApply(next,true))setMessage('正在结合现有食材和补买选择搭配，结果见下方。');};
  const exclusions=assessment.suggestions.filter(item=>item.matchable&&item.direction==='avoid'&&!savedFoods.includes(item.foodName)).map(item=>item.foodName);
  return <section className="ai-food-suggestions" aria-label="AI食材建议"><div className="guidance-title"><h3>适合你的食材选择</h3><span>结合你的健康情况与目标</span></div>
    <div className="guidance-groups">{(['prefer','limit','avoid'] as const).map(direction=>{const items=assessment.suggestions.filter(item=>item.direction===direction);return items.length>0&&<section className={`guidance-group guidance-${direction}`} key={direction}><h4>{direction==='prefer'?'推荐选择':direction==='limit'?'建议少选':'建议避开'}</h4>{items.map(item=><article key={item.foodName}><strong>{item.foodName}</strong><p>{item.reason}</p>{item.conditions&&<small>{item.conditions}</small>}{!item.matchable&&<small>暂未匹配到目录食材，仅作参考。</small>}</article>)}</section>;})}</div>
    {Boolean(assessment.recipes?.length)&&<details className="guidance-recipes"><summary>看看图鉴中的搭配 · {assessment.recipes!.length} 道</summary><ul className="ai-recipe-examples">{assessment.recipes!.map(recipe=><li key={recipe.recipeId}><a href={`/recipes?dish=${encodeURIComponent(recipe.name)}&taste=${encodeURIComponent(recipe.flavor)}`} target="_blank" rel="noopener noreferrer">{recipe.name} · {recipe.flavor} ↗</a><small>{recipe.matchedFoods.join('、')}</small></li>)}</ul><p className="small subtle">这里是食材搭配示例，筛选本餐时会再核对库存与补买。</p></details>}
    <details className="guidance-adjust"><summary>调整本餐选择</summary>{assessment.suggestions.filter(item=>item.matchable).map(item=><label className="ai-food-meal-choice" key={item.foodName}><span>{item.foodName}</span><select aria-label={`${item.foodName}的本餐处理方式`} value={selection[item.foodName]??'reference'} onChange={event=>setSelection(value=>({...value,[item.foodName]:event.target.value as Choice}))}><option value="reference">仅作参考</option><option value="preferred">优先推荐</option><option value="limited">少选</option><option value="excluded">本餐排除</option></select></label>)}</details>
    <div className="ai-food-actions"><button className="primary" onClick={apply}>结合现有食材搭配这一餐</button>{exclusions.length>0&&<button onClick={()=>{if(onSave([...new Set([...savedFoods,...exclusions])]))setMessage('已加入个人AI去疾，健康模式下会持续排除。');}}>将建议避开的食材加入AI去疾</button>}</div><p className="small subtle">保留你的调料、人数和补买设置，过敏与忌口始终生效。</p>{message&&<p role="status">{message}</p>}
  </section>;
}
