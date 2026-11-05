import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { buildChatContext,type ChatMessage } from '../shared/health-chat';
import { estimatedTokens,selectionInputBudget } from '../shared/context-budget';
import { createHealthRecipeSelector,type SelectionDiagnostics } from '../backend/src/health-recipe-selection';
import { constructedContent } from '../shared/catalog';
import { mealWith,request,simpleRecipe } from './fixtures';
import { runRecipeEvidenceTask,type RecipeEvidenceBinding } from '../backend/src/recipe-evidence';
import type { ContentSnapshot } from '../shared/content';
import type { KnowledgeBundle } from '../shared/health-knowledge';

test('长会话保留早期限制原话和最近更正，摘录不冒充确诊，压缩不改变源消息',()=>{
  const history:ChatMessage[]=[{role:'user',content:'我对花生过敏，医生说暂时不要喝酒。'},{role:'assistant',content:'旧的构造答复'}];
  for(let i=0;i<15;i++)history.push({role:'user',content:`讨论第${i}道菜。`+'甲'.repeat(100)},{role:'assistant',content:'乙'.repeat(300)});
  const before=JSON.stringify(history),result=buildChatContext(history,'更正：这次只有一人吃，不补买。');
  assert.equal(JSON.stringify(history),before);assert.equal(result.messages.at(-1)?.content,'更正：这次只有一人吃，不补买。');
  assert(JSON.stringify(result.messages).includes('我对花生过敏'));assert(JSON.stringify(result.messages).includes('可能不完整、已被更正'));
  assert(result.excerptedMessages>0);assert(result.omittedMessages>0);assert(result.messages.length<=15);assert(result.estimatedTokens<=6000);
  assert(result.messages.every((message,index)=>message.role===(index%2===0?'user':'assistant')),'摘要后仍满足服务端交替轮次契约');
  const reset=buildChatContext([],'已删去旧健康关注，重新开始');assert(!JSON.stringify(reset).includes('花生'));assert.equal(reset.excerptedMessages,0);
});

const envelope=(choices:unknown[],summary='构造建议')=>Response.json({id:'review-test-invocation-12345678',model:'deepseek-flash',usage:{prompt_tokens:80,completion_tokens:40,total_tokens:120},choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary,choices})}}]});
const meal=()=>({...mealWith('西红柿600g鸡蛋5个'),health:true,allowBuy:true,composition:'custom' as const,counts:{meat:0,veg:1,soup:0}});
const selectorInput=(recipes:ReturnType<typeof simpleRecipe>[],fetcher:typeof fetch)=>({request:request(meal()),owner:'review-test',apiKey:'sk-review-test-only-1234567890',context:{...constructedContent,recipes,contentVersion:'review-fixture'},signal:new AbortController().signal,fetcher,present:(dish:any)=>dish,claim:async()=>{},progress:()=>{}});

test('大候选池拒选是未完成；范围与完整做法进入请求，模型只调用一次并保留真实usage',async()=>{
  const recipes=Array.from({length:64},(_,i)=>simpleRecipe(`r${i}`,[['tomato',1]]));
  for(const recipe of recipes)recipe.variants[0].steps=Array.from({length:9},(_,i)=>`第${i+1}步`+(i===8?'最后沥去汤汁，不能省略此步':'按原文操作'));
  let calls=0;const diagnostics:SelectionDiagnostics[]=[];
  const input=selectorInput(recipes,async(_url,init)=>{
    calls++;const body=JSON.parse(String(init?.body)),packet=JSON.parse(body.messages.at(-1).content);
    assert.equal(packet.scope.complete,false);assert.equal(packet.scope.qualifiedParents,64);assert(packet.catalog.length<=48);
    assert(packet.catalog.every((c:any)=>c.steps.length===9&&c.steps[8].includes('沥去汤汁')));
    assert(estimatedTokens(body.messages.map((m:any)=>m.content).join(''))<=selectionInputBudget);
    return envelope([],'整个目录都不适合（构造不可靠断言）');
  });
  const result=await createHealthRecipeSelector(randomBytes(32))({...input,observe:d=>diagnostics.push(d)});
  assert.equal(result.status,'unavailable');assert.equal(result.search,'incomplete');assert.match(result.reasons.join(''),/部分候选/);assert.equal(calls,1);
  assert.equal(diagnostics.length,1);assert.equal(diagnostics[0].stage,'declined');assert.equal(diagnostics[0].invocation.totalTokens,120);
  assert(!JSON.stringify(diagnostics).includes(input.apiKey));assert(!JSON.stringify(diagnostics).includes('健康关注'));
});

test('过长的必需配方在认领/调用前终止，不能截断最后做法凑预算',async()=>{
  const recipe=simpleRecipe('huge',[['tomato',1]]);recipe.variants[0].steps=['字'.repeat(14000)];let claims=0,calls=0;
  const input=selectorInput([recipe],async()=>{calls++;return envelope([]);});input.claim=async()=>{claims++;};
  await assert.rejects(createHealthRecipeSelector(randomBytes(32))(input),error=>(error as {code:string}).code==='AI_INPUT_TOO_LARGE');
  assert.equal(claims,0);assert.equal(calls,0);
});

test('合法JSON但非法目录ID仍记录已消耗usage，不降级返回普通菜谱',async()=>{
  const diagnostics:SelectionDiagnostics[]=[];
  await assert.rejects(createHealthRecipeSelector(randomBytes(32))({...selectorInput([simpleRecipe('real',[['egg',1]])],async()=>envelope([{id:'invented',reason:'构造'}])),observe:d=>diagnostics.push(d)}));
  assert.equal(diagnostics.length,1);assert.equal(diagnostics[0].stage,'invalid');assert.equal(diagnostics[0].invocation.totalTokens,120);
});

async function evidenceFixture(){
  const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
  const content:ContentSnapshot=await read('datasets/health/recipe-research/recipe-snapshot.json'),knowledge:KnowledgeBundle=await read('datasets/health/2026-10-28-v2/knowledge-bundle.json'),bindings:RecipeEvidenceBinding[]=await read('datasets/health/recipe-research/bindings.json');
  const recipe=content.recipes.find(r=>r.name==='白菜豆腐汤')!;
  return {content,knowledge,bindings,recipeId:recipe.id,variantId:recipe.variants[0].id,context:{adult:'yes'}};
}
test('真实配方食材级证据同时保留优先与限制、未知覆盖及可定位引用，不批准整菜',async()=>{
  const f=await evidenceFixture(),r=await runRecipeEvidenceTask({...f,load:async()=>({...f,revoked:new Set()})});
  assert.equal(r.state,'research_annotations');assert.equal(r.executionAllowed,false);assert.equal(r.clinicalRelease,null);
  assert.deepEqual(r.annotations.map(a=>a.action).sort(),['limit','prefer']);assert(r.uncoveredFoodIds.length>0);
  assert(r.annotations.every(a=>a.citations.length>0));assert.equal(r.trace.length,3);
});
test('缺关键条件、撤回、错绑和预算耗尽分别终止；撤回发生在发布前也清空全部注解',async()=>{
  const f=await evidenceFixture(),base={...f,load:async()=>({...f,revoked:new Set<string>()})};
  assert.equal((await runRecipeEvidenceTask({...base,context:{}})).state,'needs_confirmation');
  assert.equal((await runRecipeEvidenceTask({...base,context:{adult:'no'}})).state,'not_applicable');
  assert.equal((await runRecipeEvidenceTask({...base,maxToolCalls:2})).state,'budget_exhausted');
  const changed=structuredClone(f.content);changed.recipes.find(r=>r.id===f.recipeId)!.variants[0].steps.push('构造额外做法');
  assert.equal((await runRecipeEvidenceTask({...base,load:async()=>({...f,content:changed,revoked:new Set()})})).state,'stale_binding');
  let reads=0;const late=await runRecipeEvidenceTask({...base,load:async()=>({...f,revoked:new Set(++reads===2?['nhc-hypertension-2023']:[])})});
  assert.equal(late.state,'withdrawn');assert.equal(late.annotations.length,0);assert.equal(reads,2);
  const abort=new AbortController();abort.abort();assert.equal((await runRecipeEvidenceTask({...base,signal:abort.signal})).state,'cancelled');
});
