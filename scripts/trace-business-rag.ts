/** Public constructed example. Capture the exact model request and stop before network. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createLocalFoodGuidanceProvider,readFoodGuidanceAssets} from '../backend/src/rag/food-guidance-repository';
import {researchFoodChat} from '../backend/src/rag/food-guidance-chat';
import {createHealthRecipeSelector} from '../backend/src/health-recipe-selection';
import {verifyGalleryBundle} from '../backend/src/cloudbase-content';
import {contentContext} from '../shared/content';
import {defaultMeal} from '../shared/types';
import {extractText} from '../shared/extraction';
import {DomainError} from '../backend/src/recommendation';

const output='artifacts/acceptance/business-rag-example-2026-11-05';
await mkdir(output,{recursive:true});
const directory='.local-data/cloudbase-http/listed-foods-20261026-v28';
const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
const content=contentContext(verifyGalleryBundle(JSON.parse(await readFile(join(directory,'gallery-bundle.json'),'utf8')),manifest.hash));
const provider=await createLocalFoodGuidanceProvider();
try{
  const text='我是成年人，我有高脂血症，我想减脂';
  const chatRequest={operationId:crypto.randomUUID(),diseases:[],profile:{conditions:[],goals:[],notes:''},messages:[{role:'user' as const,content:text}]};
  const chat=await researchFoodChat(chatRequest,content,provider);
  const parsed=extractText('白菜500g豆腐500g',content);
  const meal={...defaultMeal(),health:true,composition:'custom' as const,counts:{meat:0,veg:0,soup:1},allowBuy:false,
    ingredients:parsed.ingredients.map(i=>({...i,status:'confirmed' as const})),
    restrictions:extractText('花生过敏',content).restrictions.map(r=>({...r,status:'confirmed' as const})),
    healthProfile:{...chat.assessment!.profile!,suggestions:[],updatedAt:'2026-11-05'}};
  let captured:any,selectionError:string|undefined;
  const captureOnly:typeof fetch=async(url,init)=>{
    if(String(url)!=='https://api.deepseek.com/chat/completions')throw Error('UNEXPECTED_MODEL_URL');
    captured=JSON.parse(String(init?.body));
    // No fetch call and no synthetic model reply/receipt. Capture is the last step.
    throw new DomainError('PUBLIC_TRACE_PREPARED',409,'Public trace prepared; no model request sent');
  };
  try{
    await createHealthRecipeSelector(randomBytes(32),provider)({
      request:{operationId:crypto.randomUUID(),meal,action:'generate',selected:[],page:0,previous:[]},
      owner:'public-constructed-example',apiKey:'synthetic-capture-only-not-a-real-key',context:content,
      signal:AbortSignal.timeout(60000),fetcher:captureOnly,present:d=>d,claim:async()=>{},progress:()=>{},
    });
  }catch(error){selectionError=error instanceof DomainError?error.code:'UNEXPECTED_ERROR';}
  if(selectionError!=='PUBLIC_TRACE_PREPARED'||!captured)throw Error('TRACE_DID_NOT_REACH_EXPECTED_REQUEST');
  const packet=JSON.parse(captured.messages[1].content),assets=await readFoodGuidanceAssets();
  const trace={date:'2026-11-05',kind:'actual_local_retrieval_and_exact_prompt_capture_no_generation',
    realPaidCalls:0,generationStatus:'awaiting_user_initiated_UI_call; no synthetic response',
    input:{text,ingredients:'白菜500g豆腐500g',allergy:'花生',allowBuy:false,counts:meal.counts,meal},
    knowledge:{base:assets.bundle.id,baseSources:assets.bundle.sources.length,baseEvidence:assets.bundle.evidence.length,baseFacts:assets.bundle.facts.length,goal:assets.goals.id,goalFacts:assets.goals.facts.length,goalEvidence:assets.goals.evidence.length},
    content:{version:content.contentVersion,recipes:content.recipes.length},
    chatRequest,chatReply:chat,retrieval:chat.researchGuidance,modelRequest:captured,packet,
    caveat:'Business path uses explicit guidance filtering and recipe binding, not dense top-k or a cross-encoder. The output still requires an actual model call and final program checks.'};
  await writeFile(join(output,'trace.json'),JSON.stringify(trace,null,2)+'\n');
  await writeFile(join(output,'prompt-system.txt'),captured.messages[0].content+'\n');
  await writeFile(join(output,'prompt-user.json'),JSON.stringify(packet,null,2)+'\n');
  console.log(JSON.stringify({output,guidance:trace.retrieval?.guidance.length,evidence:trace.retrieval?.evidence.length,injectedGuidance:packet.evidenceGuidance.guidance.length,injectedEvidence:packet.evidenceGuidance.evidence.length,candidates:packet.catalog.length,realPaidCalls:0,generationStatus:trace.generationStatus}));
}finally{await provider.close?.();}
