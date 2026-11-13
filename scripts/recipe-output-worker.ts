/** Fresh child per explicit run: key is received on stdin, never in args/env/logs. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {readOutputDataset,readOutputLabels,readEvaluationContent,outputInferenceInput,outputMeal,outputHash,scoreOutput} from './lib/recipe-output-evaluation';
import {outputCampaign,outputCampaignDirectory,openOutputLiveFetch} from './lib/output-evaluation-budget';
import {createHealthRecipeSelector} from '../backend/src/health-recipe-selection';
import {sourceHashes,sourceFingerprint} from './lib/source-fingerprint';
import {randomUUID,createHash} from 'node:crypto';
import type {RecommendationResult} from '../shared/types';
import type {FoodGuidancePacket} from '../shared/food-guidance';
import {understandHealthInput,type HealthInputUnderstanding} from '../backend/src/health-input-understanding';
import {requestHealthChat} from '../backend/src/health-chat';
import {researchFoodChat} from '../backend/src/rag/food-guidance-chat';
import type {HealthChatReply} from '../shared/health-chat';
import {explainKnownTopic} from '../backend/src/rag/topic-explanation';
import {evaluationGuidance,assertParentHistory,publicError} from './lib/output-round';

async function main(){
 let raw='';for await(const chunk of process.stdin){raw+=chunk.toString();if(Buffer.byteLength(raw)>10000)throw Error('OUTPUT_WORKER_INPUT_TOO_LARGE');}
 const request=JSON.parse(raw);raw='';
 if(Object.keys(request).some(k=>!['caseId','variant','mode','key','replayRunId'].includes(k))||!['baseline','rag'].includes(request.variant)||!['fixture','live','replay'].includes(request.mode)||request.mode==='live'&&(typeof request.key!=='string'||request.key.length<8||request.key.length>512)||process.env.LOCAL_RAG_OUTPUT_EVALUATION!=='1'||process.versions.node.split('.')[0]!=='24')throw Error('OUTPUT_WORKER_EXPLICIT_AUTH_REQUIRED');
 const dataset=await readOutputDataset(),item=dataset.cases.find(c=>c.id===request.caseId);if(!item)throw Error('OUTPUT_UNKNOWN_CASE');
 let replay:any;
 if(request.mode==='replay'){
  if(typeof request.replayRunId!=='string'||!/^[\w.-]+$/.test(request.replayRunId))throw Error('OUTPUT_REPLAY_ID_INVALID');
  replay=JSON.parse(await readFile(join(outputCampaignDirectory,'runs',request.replayRunId,'report.json'),'utf8'));
  if(replay.caseId!==item.id||replay.variant!==request.variant||outputHash(replay.input)!==outputHash(outputInferenceInput(item))||replay.mode!=='live')throw Error('OUTPUT_REPLAY_INPUT_MISMATCH');
 }
 await assertParentHistory(item.input);
 const hashes=await sourceHashes(),fingerprint=sourceFingerprint(hashes),catalog=await readEvaluationContent(),{assets,provider,expansion}=await evaluationGuidance();
 const runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8),directory=join(outputCampaignDirectory,'runs',runId);await mkdir(directory,{recursive:true});
 const traces:any[]=[];let attempts=0,result:RecommendationResult|undefined,packet:FoodGuidancePacket|undefined,error:string|undefined,ctx:ReturnType<typeof outputMeal>|undefined,understanding:HealthInputUnderstanding|undefined,reply:HealthChatReply|undefined;
 const unmetNeeds:string[]=[];
 let explanation:Awaited<ReturnType<typeof explainKnownTopic>>;
 const live=request.mode==='live'&&item.task!=='food_guidance'?await openOutputLiveFetch():undefined;
 const fetcher:typeof fetch=async(url,init)=>{
  attempts++;const body=JSON.parse(String(init?.body));
  const trace:any={request:body};traces.push(trace);
  let response:Response;
  if(replay){
   const prior=replay.traces[attempts-1];if(!prior?.response||outputHash(prior.request)!==outputHash(body))throw Error('OUTPUT_REPLAY_PROMPT_OR_PARAMETERS_CHANGED');
   response=Response.json(prior.response);
  }else if(live){response=await live.fetch(url,init);}
  else{
   // Fixture only checks execution/contracts, never advertised as real generation quality.
   let input:any;try{input=JSON.parse(body.messages.at(-1).content);}catch{}
   const remaining=[...(input?.catalog??[])],chosen:any[]=[];
   for(const [category,n] of Object.entries(input?.categories??{}) as [string,number][]){for(let i=0;i<n;i++){const at=remaining.findIndex(c=>c.category===category);if(at<0)throw Error('OUTPUT_FIXTURE_NO_FEASIBLE_CATEGORY');chosen.push(remaining.splice(at,1)[0]);}}
   const content=input?.catalog?{summary:'构造供应商，仅检查契约',choices:chosen.map(c=>({id:c.id,reason:'按当前明列食材与类别选择；构造输出不评价模型质量。'}))}:input?.text?{intent:'clarify',subject:'unspecified',conditions:[],goals:[],preferences:[],allergies:[],avoids:[],mealRequest:{ingredients:[],servings:null,counts:null,allowBuy:null},question:'请说明本次做饭需求。'}:{reply:'构造供应商未做语义理解。',stage:'clarify',suggestions:[],profile:{conditions:[],goals:[],notes:''}};
   response=Response.json({id:'fixture-'+runId,model:'deepseek-flash',usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2},choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]});
  }
  const text=await response.clone().text();if(Buffer.byteLength(text)>65536)throw Error('OUTPUT_TRACE_TOO_LARGE');
  trace.response=JSON.parse(text);return response;
 };
 const started=performance.now();
 try{
  if(item.task==='food_guidance'){const input=outputInferenceInput(item);packet=await provider.prepare({...input,content:catalog.content});}
  else if(item.task==='open_input'){
   const text=item.input.userText!;
   const chatBody={operationId:runId,diseases:item.input.profile.conditions,profile:item.input.profile,messages:[...(item.input.history??[]),{role:'user' as const,content:text}],apiKey:request.mode==='live'?request.key:'fixture-no-real-key'};
   if(request.variant==='baseline')reply=await requestHealthChat(chatBody,AbortSignal.timeout(90000),fetcher,name=>catalog.content.restrictionTargets(name).length>0);
   else{
    const parsed=await understandHealthInput(text,chatBody.apiKey,AbortSignal.timeout(90000),fetcher,item.input.history);understanding=parsed.understanding;
    const profile={conditions:understanding.conditions,goals:understanding.goals,notes:[...(item.input.history??[]).filter(m=>m.role==='user').map(m=>m.content),text].join('\n').slice(-400)};
    const respond=(content:string):HealthChatReply=>({operationId:runId,knowledge:'research_rag',message:{role:'assistant',content}});
    if(understanding.intent==='off_topic')reply=respond('这里主要帮助你选择食材和菜品。你可以说说今晚想吃什么，或希望满足哪些饮食需求。');
    else if(understanding.intent==='medical_request')reply=respond('我不能做诊断或提供停药改药、治愈疾病的方案。可以继续帮你整理有依据的饮食参考；未覆盖的问题会明确保留，涉及治疗请向医生确认。');
    else if(understanding.intent==='clarify')reply=respond(understanding.question||'你希望我帮你选食材，还是用现有食材安排一餐？');
    else{
     packet=await provider.prepare({profile,content:catalog.content,currentText:text});unmetNeeds.push(...packet.uncoveredTopics);
     const preferences=understanding.preferences.length?`已理解本次偏好：${understanding.preferences.join('、')}。价格、时长等未有精确核验时不会宣称已满足。`:'';
     if(understanding.intent==='meal'&&(item.input.ingredients!==undefined||understanding.mealRequest.ingredients.length)){
      const actual={...item,input:{...item.input,profile,ingredients:item.input.ingredients??understanding.mealRequest.ingredients.join('、'),servings:item.input.servings??understanding.mealRequest.servings??undefined,counts:item.input.counts??understanding.mealRequest.counts??undefined,allowBuy:item.input.allowBuy??understanding.mealRequest.allowBuy??false,allergies:[...new Set([...(item.input.allergies??[]),...understanding.allergies])],avoids:[...new Set([...(item.input.avoids??[]),...understanding.avoids])]}};
      ctx=outputMeal(actual,catalog.snapshot);
      result=await createHealthRecipeSelector(createHash('sha256').update('public-evaluation-fixed-comparison-seed-v1').digest(),provider)({request:{operationId:item.family,meal:ctx.meal,action:'generate',selected:[],page:0,previous:[]},owner:'constructed-open-evaluation',apiKey:chatBody.apiKey,context:ctx.content,signal:AbortSignal.timeout(90000),fetcher,present:d=>d,claim:async()=>{},progress:()=>{}});
      reply=respond((result.status==='completed'?'已按本餐条件选出真实菜品。':result.reasons.join('；').replace(/([。！？])；/g,'$1'))+preferences);
     }else if(understanding.intent==='meal'){
      unmetNeeds.push('pantry_not_provided');reply=respond(preferences+'可以按你的需求继续安排菜品。'+(understanding.question||'你手头有哪些食材？'));
     }else{
      reply=await researchFoodChat({...chatBody,profile,mealContext:{ingredients:[],seasonings:[],restrictions:[...understanding.allergies.map(n=>'过敏：'+n),...understanding.avoids.map(n=>'忌口：'+n)],allowBuy:false}},catalog.content,provider);
      const uncovered=(packet.topicCoverage?.filter(t=>t.status==='knowledge_gap').map(t=>t.input)??packet.uncoveredTopics).map(t=>t.replace(/^(condition|goal):/,''));
      if(uncovered.length){const hasKnownScope=packet.topicCoverage?.some(t=>t.status!=='knowledge_gap')??packet.guidance.some(g=>g.applicability==='applicable');reply.message.content=(hasKnownScope?reply.message.content:'我已理解你的饮食关注。')+`当前核验资料尚未覆盖${uncovered.join('、')}，这部分不能给出有据的健康结论。仍可按现有食材、过敏忌口与做饭偏好选择普通菜品，健康判断保留。`;}
      const inapplicable=packet.topicCoverage?.filter(t=>t.status==='not_applicable').map(t=>t.input.replace(/^(condition|goal):/,''))??[];
      if(inapplicable.length)reply.message.content+=`目前条件不满足${inapplicable.join('、')}现有指导的适用范围，未套用该指导。`;
      reply.message.content+=preferences;
      explanation=await explainKnownTopic(understanding,text);
      if(explanation){reply.message.content=explanation.answer;unmetNeeds.splice(0,unmetNeeds.length,...unmetNeeds.filter(t=>!t.endsWith(':甲减')&&!t.endsWith(':桥本')&&!t.endsWith(':甲状腺功能减退症')),...explanation.unmetNeeds);}
     }
    }
   }
  }else{
   ctx=outputMeal(item,catalog.snapshot);
   const secret=createHash('sha256').update('public-evaluation-fixed-comparison-seed-v1').digest();
   result=await createHealthRecipeSelector(secret,request.variant==='rag'?provider:undefined)({request:{operationId:item.family,meal:ctx.meal,action:'generate',selected:[],page:0,previous:[]},owner:'constructed-output-evaluation',apiKey:request.mode==='live'?request.key:'fixture-no-real-key',context:ctx.content,signal:AbortSignal.timeout(90000),fetcher,present:d=>d,claim:async()=>{},progress:()=>{}});
   packet=await provider.prepare({profile:item.input.profile,content:ctx.content});
  }
 }catch(e){error=e&&typeof e==='object'&&'code' in e?String(e.code):e instanceof Error?e.message:'OUTPUT_RUN_FAILED';if(request.key)error=error.split(request.key).join('[redacted]');}
 finally{await live?.close();}
 const labels=await readOutputLabels(); // Never imported before inference.
 const topicStates=packet?.topicCoverage?.map(t=>t.status)??[];
 const coverage=explanation?'qualitative_explanation_only':packet?(topicStates.includes('knowledge_gap')?(topicStates.some(s=>s!=='knowledge_gap')?'partial':'uncovered'):topicStates.includes('needs_topic_detail')?'needs_topic_detail':packet.missingConditions.length?'needs_confirmation':topicStates.includes('available')?'some_support':topicStates.includes('not_applicable')?'not_applicable':'no_applicable_evidence'):understanding&&['off_topic','medical_request','clarify'].includes(understanding.intent)?'not_retrieval_task':'unverified';
 const observed={result,packet,attempts,error,...(error?{userError:publicError(error)}:{}),understanding,reply,unmetNeeds,coverage,explanation,...(ctx?{mealSettings:{checkSeasonings:ctx.meal.checkSeasonings,seasonings:ctx.meal.seasonings,allowBuy:ctx.meal.allowBuy,servings:ctx.meal.servings,counts:ctx.meal.counts}}:{})};
 const report={schemaVersion:1,campaign:outputCampaign,runId,caseId:item.id,title:item.title,family:item.family,split:item.split,task:item.task,variant:request.variant,mode:item.task==='food_guidance'?'deterministic_guidance':request.mode,input:outputInferenceInput(item),expected:labels.labels[item.id],observed,score:scoreOutput(item,labels.labels[item.id],observed,ctx),humanReview:null,
  provenance:{datasetHash:dataset.sha256,inputHash:outputHash(outputInferenceInput(item)),labelsHash:labels.sha256,catalogVersion:catalog.content.contentVersion,catalogHash:catalog.sha256,knowledge:assets.bundle.id,knowledgeHash:outputHash(assets.bundle),expansion,goalsHash:outputHash(assets.goals),mappingHash:outputHash(assets.mappings),parentRunId:item.input.parentRunId,explanation:explanation?{id:explanation.id,sha256:explanation.sha256,pgImported:false,newVectors:false}:undefined,mapping:assets.mappings.id,sourceFingerprint:fingerprint,promptHashes:traces.map(t=>outputHash(t.request.messages)),model:'deepseek-flash'},
  traces,latencyMs:Math.round(performance.now()-started),actualProviderCalls:live?.networkAttempts()??0,fixtureCalls:request.mode==='fixture'?attempts:0,replayOf:replay?request.replayRunId:undefined,replayedResponses:replay?attempts:0,sourceStable:fingerprint===sourceFingerprint(await sourceHashes()),scope:'Project engineering evaluation; no independent clinical accuracy claim; labels withheld from inference. Replay reuses an identical stored supplier request/response without a new API call.'};
 if(!report.sourceStable)report.score.hardFailures.push('source_changed_during_run');
 if(report.score.hardFailures.length){report.score.functionalPass=false;report.score.effectivePass=null;}
 await writeFile(join(directory,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({runId,caseId:item.id,mode:report.mode,functionalPass:report.score.functionalPass}));
}
main().catch(()=>{console.error('OUTPUT_WORKER_FAILED_CONFIGURATION_OR_BUDGET');process.exitCode=1;});
