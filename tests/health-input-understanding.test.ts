import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHealthInputUnderstanding,understandHealthInput} from '../backend/src/health-input-understanding';
const base=()=>({intent:'food_guidance',subject:'self',conditions:['甲减'],goals:[],preferences:[],allergies:[],avoids:[],mealRequest:{ingredients:[],servings:null,counts:null,allowBuy:null},question:''});
test('开放理解允许库外原词，不允许模型补入输入中没有的疾病/食材或非法菜数',()=>{
 const input='我有甲减，怎么选食材？';assert.deepEqual(validateHealthInputUnderstanding(base(),input),base());
 assert.throws(()=>validateHealthInputUnderstanding({...base(),conditions:['高血压']},input),/UNSUPPORTED_ENTITY/);
 assert.throws(()=>validateHealthInputUnderstanding({...base(),mealRequest:{...base().mealRequest,ingredients:['鸡蛋']}},input),/MEAL_INVALID/);
 assert.throws(()=>validateHealthInputUnderstanding({...base(),mealRequest:{...base().mealRequest,counts:{meat:20,veg:20,soup:20}}},input),/MEAL_INVALID/);
});
test('输入理解使用固定适配器、只接收原话；凭证不进入Prompt，不因库外主题重试',async()=>{
 let calls=0;
 const result=await understandHealthInput('我有甲减，怎么选食材？','secret-fixture-key',AbortSignal.timeout(10000),async(url,init)=>{
  calls++;assert.equal(String(url),'https://api.deepseek.com/chat/completions');const request=JSON.parse(String(init?.body));assert.equal(request.max_tokens,1200);assert(!JSON.stringify(request.messages).includes('secret-fixture-key'));assert(!JSON.stringify(request.messages).includes('expected'));
  return Response.json({id:'fixture-open-input-123456',model:'deepseek-flash',usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2},choices:[{finish_reason:'stop',message:{content:JSON.stringify(base())}}]});
 });
 assert.equal(calls,1);assert.equal(result.understanding.conditions[0],'甲减');
});
test('多轮只允许从用户历史取情况，助手猜测不能变成已确诊事实',async()=>{
 const history=[{role:'user' as const,content:'我有甲减，想问食材。'},{role:'assistant' as const,content:'你可能还有肾病，需要确认。'}];
 const fetcher=(conditions:string[]):typeof fetch=>async(_u,init)=>{
  const request=JSON.parse(String(init?.body)),data=JSON.parse(request.messages[1].content);assert.deepEqual(data.history,history);assert.equal(data.text,'我不知道病因。');
  return Response.json({id:'fixture-history-proof-123',model:'deepseek-flash',usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2},choices:[{finish_reason:'stop',message:{content:JSON.stringify({...base(),conditions})}}]});
 };
 const understood=await understandHealthInput('我不知道病因。','fixture-key',AbortSignal.timeout(10000),fetcher(['甲减']),history);assert.deepEqual(understood.understanding.conditions,['甲减']);
 await assert.rejects(understandHealthInput('我不知道病因。','fixture-key',AbortSignal.timeout(10000),fetcher(['肾病']),history),/UNSUPPORTED_ENTITY/);
});
