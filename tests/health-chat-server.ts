import { createApp } from '../server/app';
import { fixture } from './registration-fixture';
import { resolve } from 'node:path';
if(process.env.HEALTH_CHAT_E2E!=='1')throw Error('TEST_SERVER_DISABLED');
const {db,accounts}=await fixture();
const app=await createApp({accounts,origin:'http://127.0.0.1:4198',environment:'local',staticRoot:resolve('build/web'),healthChatFetch:async(_url,init)=>{
  const key=new Headers(init?.headers).get('authorization')??'';
  if(key.includes('rejected'))return new Response('private upstream error',{status:401});
  const input=JSON.parse(String(init?.body)),messages=input.messages.filter((m:any)=>m.role!=='system');
  if(messages.at(-1).content==='测试慢回复')await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(resolve,5000);init!.signal!.addEventListener('abort',()=>{clearTimeout(timer);reject(init!.signal!.reason);},{once:true});
  });
  const guide=messages.at(-1).content.includes('应用建议');
  const advice={reply:guide?'**1. 蔬菜（每天尽量多安排） **\n- **西红柿**：构造食材选择说明。\n\n是否同意将花生加入 AI去疾？':`构造AI回复：已收到 ${messages.length} 条对话消息。\n可以结合食材与烹调方式讨论。`,stage:guide?'advice':'clarify',suggestions:guide?[
    {foodName:'西红柿',direction:'prefer',reason:'构造优先选择依据',conditions:''},
    {foodName:'花生',direction:'avoid',reason:'构造排除建议，等待用户同意',conditions:'仅为测试建议'},
    {foodName:'猪肉',direction:'limit',reason:'构造少选建议',conditions:''},
    {foodName:'火星草',direction:'avoid',reason:'目录外测试项',conditions:''},
  ]:[]};
  return Response.json({id:'mock-deepseek-'+crypto.randomUUID(),model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180},choices:[{finish_reason:'stop',message:{content:JSON.stringify(advice)}}]});
}});
await app.listen({host:'127.0.0.1',port:4198});
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>void app.close().then(()=>db.close()));
