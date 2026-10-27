import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ChatMarkdown } from '../src/chat-markdown';
import { recommend,checkDish } from '../server/recommendation';
import { constructedContent as context } from '../shared/catalog';
import { mealWith,request,simpleRecipe } from './fixtures';
import { personalSettings } from '../shared/account';
import { requestHealthChat } from '../server/health-chat';

test('截图中的Markdown按强调和列表呈现，模型HTML/脚本/链接不执行',()=>{
  const html=renderToStaticMarkup(React.createElement(ChatMarkdown,{text:'**1. 蔬菜（每天尽量多安排） **\n- **菠菜**：说明\n- 西红柿\n\n<script>alert(1)</script>\n[危险链接](javascript:alert(1))'}));
  assert(html.includes('<ol'));assert(html.includes('<ul'));assert(html.includes('<strong>菠菜</strong>'));assert(!html.includes('**'));
  assert(!html.includes('<script>'));assert(!html.includes('href='));assert(html.includes('&lt;script&gt;'));
});

test('AI去疾独立于过敏/忌口，仅健康模式执行，调料/可选项也参与排除',async()=>{
  const meal=mealWith();meal.health=true;meal.allowBuy=true;meal.mode='candidates';meal.aiFoodChoices={preferred:[],limited:[],excluded:['花生']};
  const recipes=[simpleRecipe('peanut-r',[['peanut',100]]),simpleRecipe('tomato-r',[['tomato',100]])];
  const saved=JSON.stringify(meal.restrictions);
  const result=await recommend(recipes,request(meal),{context,conversationOnly:true});assert.deepEqual(result.dishes.map(d=>d.recipe.id),['tomato-r']);assert.equal(JSON.stringify(meal.restrictions),saved);
  meal.health=false;
  const normal=await recommend(recipes,request(meal),{context});assert.equal(normal.dishes.length,2);
  meal.health=true;const optional=simpleRecipe('optional',[['tomato',100],['peanut',10]]);optional.variants[0].lines[1].optional=true;optional.variants[0].lines[1].role='seasoning';
  assert(!checkDish(optional,optional.variants[0],meal,context).dish);
  assert.equal(personalSettings(meal).aiFoodChoices,undefined);
});

test('已填食材/调料和不补买不被AI偏好放宽，优先/少选只排序合格菜',async()=>{
  const meal=mealWith('西红柿200g鸡蛋3个');meal.health=true;meal.mode='candidates';meal.flavor='不限';meal.aiFoodChoices={preferred:['牛肉','西红柿'],limited:['鸡蛋'],excluded:[]};
  const recipes=[simpleRecipe('egg-r',[['egg',1]]),simpleRecipe('beef-r',[['beef',100]]),simpleRecipe('tomato-r',[['tomato',100]])];
  const result=await recommend(recipes,request(meal),{context,conversationOnly:true});assert.deepEqual(result.dishes.map(d=>d.recipe.id),['tomato-r','egg-r']);assert.equal(meal.allowBuy,false);
  const denied={...meal,aiFoodChoices:{preferred:[],limited:[],excluded:['不存在的食材']}};await assert.rejects(recommend(recipes,request(denied),{context,conversationOnly:true}),/未匹配/);
});

test('套餐同菜数同分类时优先AI选择，换菜/口味/翻页继续执行AI去疾',async()=>{
  const meal=mealWith('西红柿600g鸡蛋6个花生300g');meal.health=true;meal.composition='custom';meal.counts={meat:0,veg:1,soup:0};meal.allowBuy=true;
  meal.aiFoodChoices={preferred:['西红柿'],limited:[],excluded:['花生']};
  const recipes=[simpleRecipe('egg-r',[['egg',1]]),simpleRecipe('tomato-r',[['tomato',100]]),simpleRecipe('peanut-r',[['peanut',100]])];
  const result=await recommend(recipes,request(meal),{context,conversationOnly:true});assert.equal(result.dishes[0].recipe.id,'tomato-r');
  const replacement=await recommend(recipes,request(meal,{action:'replace',selected:[{recipeId:'tomato-r',variantId:'tomato-r-v'}],replaceId:'tomato-r',previous:['tomato-r']}),{context,conversationOnly:true});assert(replacement.dishes.every(d=>d.recipe.id!=='peanut-r'));
  const variant=await recommend(recipes,request(meal,{action:'variant',selected:[{recipeId:'peanut-r',variantId:'peanut-r-v'}]}),{context,conversationOnly:true});assert.equal(variant.status,'needs_confirmation');
  meal.composition='auto';meal.mode='candidates';const pages=await recommend(recipes,request(meal),{context,conversationOnly:true});assert(pages.dishes.every(d=>d.recipe.id!=='peanut-r'));
});

test('真实调用凭证和结构化建议必须来自供应商响应，缺凭证或乱格式不冒充成功',async()=>{
  const body={operationId:crypto.randomUUID(),apiKey:'sk-test-only-123456789012345',diseases:[],messages:[{role:'user' as const,content:'应用建议'}]};
  const content=JSON.stringify({reply:'构造建议',stage:'advice',suggestions:[{foodName:'花生',direction:'avoid',reason:'测试说明',conditions:''}]});
  const envelope={id:'request-proof-12345678',model:'deepseek-flash',usage:{prompt_tokens:50,completion_tokens:40,total_tokens:90},choices:[{finish_reason:'stop',message:{content}}]};
  const result=await requestHealthChat(body,new AbortController().signal,async()=>Response.json(envelope),name=>context.restrictionTargets(name).length>0);
  assert.equal(result.assessment?.suggestions[0].matchable,true);assert.equal(result.invocation?.requestId,envelope.id);assert.equal(result.invocation?.totalTokens,90);
  for(const invalid of [{...envelope,id:undefined},{...envelope,usage:{prompt_tokens:50,completion_tokens:40,total_tokens:100}},{...envelope,choices:[{finish_reason:'stop',message:{content:'not JSON'}}]}]){
    await assert.rejects(requestHealthChat(body,new AbortController().signal,async()=>Response.json(invalid)));
  }
});
