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
  const [selection,setSelection]=useState<Record<string,Choice>>({}),[saveSelection,setSaveSelection]=useState<string[]>([]);
  const [saveDecision,setSaveDecision]=useState<'saved'|'skip'|null>(null),[applied,setApplied]=useState(false),[skipped,setSkipped]=useState(false),[saveError,setSaveError]=useState(false);
  useEffect(()=>{
    const current=choices??emptyAiChoices();
    setSelection(Object.fromEntries(assessment.suggestions.map(item=>[item.foodName,!item.matchable?'reference':current.excluded.includes(item.foodName)||savedFoods.includes(item.foodName)?'excluded':item.direction==='prefer'?'preferred':item.direction==='limit'?'limited':'excluded'])));
    setSaveSelection(assessment.suggestions.filter(item=>item.matchable&&item.direction!=='prefer').map(item=>item.foodName));
    setSaveDecision(null);setApplied(false);setSkipped(false);setSaveError(false);
  },[assessment]);
  if(!assessment.suggestions.length)return null;
  const selected=assessment.suggestions.filter(item=>item.matchable&&selection[item.foodName]&&selection[item.foodName]!=='reference');
  const toSave=assessment.suggestions.filter(item=>item.matchable&&item.direction!=='prefer');
  const apply=()=>{
    const next=structuredClone(choices??emptyAiChoices());
    for(const item of selected){for(const kind of ['preferred','limited','excluded'] as const)next[kind]=next[kind].filter(name=>name!==item.foodName);next[selection[item.foodName] as keyof AiFoodChoices].push(item.foodName);}
    if(onApply(next,true)){setApplied(true);setSkipped(false);}
  };
  return <section className="ai-food-suggestions" aria-label="确认AI食材建议">
    <section aria-label="食材建议与图鉴菜品"><h3>1. 食材建议与图鉴菜品</h3><p>根据你说明的疾病或目标，先看看推荐与不推荐的食材及原因。</p>
      <div className="ai-food-proposals">{assessment.suggestions.map(item=><div className="ai-food-proposal" key={item.foodName}><strong>{item.foodName}</strong><span className="ai-food-direction">{item.direction==='prefer'?'推荐':item.direction==='limit'?'少选':'不推荐'}</span><p>{item.reason}</p>{item.conditions&&<small>适用条件：{item.conditions}</small>}
        {!item.matchable&&<small>目录暂不能匹配此项，保留参考。</small>}</div>)}</div>
      <h4>图鉴中这样搭配的菜品</h4><p className="small subtle">依据上述食材建议匹配，尚未按本餐库存和补买设置筛选。</p>
      {assessment.recipes?.length?<ul className="ai-recipe-examples">{assessment.recipes.map(recipe=><li key={recipe.recipeId}><a href={`/recipes?dish=${encodeURIComponent(recipe.name)}&taste=${encodeURIComponent(recipe.flavor)}`} target="_blank" rel="noopener noreferrer">{recipe.name} · {recipe.flavor} ↗</a><small>含推荐食材：{recipe.matchedFoods.join('、')}</small></li>)}</ul>:<p className="small">当前图鉴没有匹配这些建议的菜品；不会编造菜谱。</p>}
    </section>
    <section aria-label="保存个人AI去疾"><h3>2. 是否保存到个人设置“AI去疾”？</h3><p>勾选你同意以后在健康模式排除的食材。保存后随账号恢复，不修改过敏或忌口。</p>
      {toSave.map(item=><label className="checkbox" key={item.foodName}><input type="checkbox" checked={saveSelection.includes(item.foodName)} onChange={event=>{setSaveSelection(value=>event.target.checked?[...value,item.foodName]:value.filter(name=>name!==item.foodName));setSaveDecision(null);}}/>{item.foodName}{savedFoods.includes(item.foodName)?'（已保存）':''}</label>)}
      {!toSave.length&&<p className="small">本轮没有可保存的排除项。</p>}
      <div className="ai-food-actions"><button disabled={!saveSelection.length} onClick={()=>{const success=onSave([...new Set([...savedFoods,...saveSelection])]);setSaveError(!success);if(success)setSaveDecision('saved');}}>同意保存到个人AI去疾</button><button onClick={()=>setSaveDecision('skip')}>{toSave.length?'暂不保存，继续本餐选择':'继续本餐选择'}</button></div>
      {saveError&&<p role="alert">未能加入个人设置，请先检查排除数量和当前登录状态。</p>}
      {saveDecision==='saved'&&<p role="status">已加入个人设置，将随账号自动同步。下面可另外选择是否筛选本餐。</p>}
      {saveDecision==='skip'&&<p role="status">保留原有个人设置，仅继续选择本餐。</p>}
    </section>
    {saveDecision&&<section aria-label="本餐AI筛选"><h3>3. 是否结合本餐食材与补买设置筛选？</h3><p>推荐食材用于优先排序；不推荐食材可排除或少选。以下选择只用于本餐，不会自动保存。</p>
      {assessment.suggestions.filter(item=>item.matchable).map(item=><label className="ai-food-meal-choice" key={item.foodName}><span>{item.foodName}</span><select aria-label={`${item.foodName}的本餐处理方式`} value={selection[item.foodName]??'reference'} onChange={event=>{setSelection(value=>({...value,[item.foodName]:event.target.value as Choice}));setApplied(false);}}><option value="reference">仅作参考</option><option value="preferred">优先推荐</option><option value="limited">少选</option><option value="excluded">本餐排除</option></select></label>)}
      <p className="small subtle">保留当前食材、调料、人数和补买选择；已保存的AI去疾、过敏与忌口继续生效。</p>
      <div className="ai-food-actions"><button className="primary" disabled={!selected.length} onClick={apply}>按本餐食材和补买设置筛选</button><button onClick={()=>{setApplied(false);setSkipped(true);}}>暂不筛选</button></div>
      {skipped&&<p role="status">本次暂不筛选，当前食材与搭配保持不变。</p>}
      {applied&&<p role="status">已按当前本餐条件发起筛选，结果见下方推荐区。</p>}
    </section>}
  </section>;
}
