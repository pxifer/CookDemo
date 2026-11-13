import { createApp } from '../backend/src/app';
import { fixture } from './registration-fixture';
import { resolve } from 'node:path';
import {readFoodGuidanceAssets} from '../backend/src/rag/food-guidance-repository';
import {createFoodGuidanceProvider} from '../backend/src/rag/food-guidance';
import {createNutritionGuidanceProvider} from '../backend/src/rag/nutrition-guidance-provider';
if(process.env.HEALTH_CHAT_E2E!=='1')throw Error('TEST_SERVER_DISABLED');
const port=Number(process.env.HEALTH_CHAT_TEST_PORT??4198);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('HEALTH_CHAT_TEST_PORT_INVALID');
const {db,accounts}=await fixture();
const assets=process.env.HEALTH_GUIDANCE_RESEARCH_E2E==='1'?await readFoodGuidanceAssets():undefined;
const foodGuidance=assets?createNutritionGuidanceProvider(createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set()),assets.expansion,async()=>new Set()):undefined;
const app=await createApp({accounts,foodGuidance,origin:`http://127.0.0.1:${port}`,environment:'local',staticRoot:resolve('artifacts/build/web'),healthChatFetch:async(_url,init)=>{
  const key=new Headers(init?.headers).get('authorization')??'';
  if(key.includes('rejected'))return new Response('private upstream error',{status:401});
  const input=JSON.parse(String(init?.body)),messages=input.messages.filter((m:any)=>m.role!=='system');
  let packet:any;try{packet=JSON.parse(messages.at(-1).content);}catch{}
  if(packet?.task==='recipe_selection'){
    const remaining={...packet.categories};const selected=packet.mode==='options'?packet.catalog.slice(0,packet.max):packet.catalog.filter((dish:any)=>{if(remaining[dish.category]>0){remaining[dish.category]--;return true;}return false;}).slice(0,packet.count);
    return Response.json({id:'mock-recipe-selection-'+crypto.randomUUID(),model:'deepseek-flash',usage:{prompt_tokens:180,completion_tokens:80,total_tokens:260},choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'构造AI选菜：结合已填食材、调料、补买许可与健康档案选择。',choices:selected.map((dish:any)=>({id:dish.id,reason:'构造AI理由：复用现有食材，结合已保存目标及明列做法。',...(packet.evidenceGuidance?{guidanceIds:dish.guidanceIds.slice(0,3)}:{})}))})}}]});
  }
  if(messages.at(-1).content==='测试慢回复')await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(resolve,5000);init!.signal!.addEventListener('abort',()=>{clearTimeout(timer);reject(init!.signal!.reason);},{once:true});
  });
  const guide=messages.at(-1).content.includes('应用建议');
  let advice:any={profile:{conditions:[],goals:guide?['增肌']:[],notes:''},reply:guide?'**1. 蔬菜（每天尽量多安排） **\n- **西红柿**：构造食材选择说明。\n\n是否同意将花生加入 AI去疾？':`构造AI回复：已收到 ${messages.length} 条对话消息。\n可以结合食材与烹调方式讨论。`,stage:guide?'advice':'clarify',suggestions:guide?[
    {foodName:'西红柿',direction:'prefer',reason:'构造优先选择依据',conditions:''},
    {foodName:'花生',direction:'avoid',reason:'构造排除建议，等待用户同意',conditions:'仅为测试建议'},
    {foodName:'猪肉',direction:'limit',reason:'构造少选建议',conditions:''},
    {foodName:'火星草',direction:'avoid',reason:'目录外测试项',conditions:''},
  ]:[]};
  const disease=messages.at(-1).content.includes('风湿')?'风湿病':messages.at(-1).content.includes('糖尿')?'糖尿病':null;
  if(disease)advice={profile:{conditions:[disease],goals:[],notes:disease+'构造摘要'},reply:'已按'+disease+'整理建议，可分别接受或取消。',stage:'advice',suggestions:[{foodName:'鸡蛋',direction:disease==='风湿病'?'prefer':'avoid',reason:disease+'构造理由',conditions:'',topics:['condition:'+disease]},{foodName:'西红柿',direction:'prefer',reason:disease+'构造理由',conditions:'',topics:['condition:'+disease]}]};
  return Response.json({id:'mock-deepseek-'+crypto.randomUUID(),model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180},choices:[{finish_reason:'stop',message:{content:JSON.stringify(advice)}}]});
}});
await app.listen({host:'127.0.0.1',port});
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>void app.close().then(()=>db.close()));
