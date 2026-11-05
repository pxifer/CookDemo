import React,{useMemo,useState} from 'react';
import type {Food} from '../../shared/types';
import {groupedFoods} from './food-groups';

export function FoodPicker({foods,add}:{foods:Food[];add:(name:string)=>void}){
  const groups=useMemo(()=>groupedFoods(foods),[foods]);
  const [category,setCategory]=useState(''),[selected,setSelected]=useState(''),[name,setName]=useState('');
  const choices=category?groups.find(group=>group.name===category)?.foods??[]:groups.flatMap(group=>group.foods);
  return <div className="food-picker">
    <form className="food-picker-select" onSubmit={e=>{e.preventDefault();if(selected){add(selected);setSelected('');}}}>
      <label>分类<select aria-label="食材分类" value={category} onChange={e=>{setCategory(e.target.value);setSelected('');}}><option value="">全部食材</option>{groups.map(group=><option key={group.name}>{group.name}</option>)}</select></label>
      <label>食材<select aria-label="选择食材" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">请选择食材</option>{choices.map(food=><option key={food.id} value={food.name}>{food.name}</option>)}</select></label>
      <button type="submit" className="food-picker-add" disabled={!selected}>添加</button>
    </form>
    <details className="food-picker-manual"><summary>搜索或直接输入食材</summary><form className="manual-add" onSubmit={e=>{e.preventDefault();if(name.trim()){add(name.trim());setName('');}}}><input aria-label="手动添加食材" list="food-names" maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="输入食材名称…"/><button className="text-button" disabled={!name.trim()}>＋ 添加</button></form></details>
  </div>;
}
