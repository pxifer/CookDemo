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
  return Response.json({choices:[{finish_reason:'stop',message:{content:`构造AI回复：已收到 ${messages.length} 条对话消息。\n可以结合食材与烹调方式讨论。`}}]});
}});
await app.listen({host:'127.0.0.1',port:4198});
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>void app.close().then(()=>db.close()));
