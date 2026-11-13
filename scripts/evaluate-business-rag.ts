import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {readFoodGuidanceAssets,createLocalFoodGuidanceProvider} from '../backend/src/rag/food-guidance-repository';
import {createFoodGuidanceProvider,guidanceHash} from '../backend/src/rag/food-guidance';
import {createHealthRecipeSelector} from '../backend/src/health-recipe-selection';
import {contentContext,type ContentSnapshot} from '../shared/content';
import {defaultMeal,type Meal} from '../shared/types';
import {extractText} from '../shared/extraction';
import {verifyGalleryBundle} from '../backend/src/cloudbase-content';
import {sourceHashes,sourceFingerprint} from './lib/source-fingerprint';

async function main(){
const args=process.argv.slice(2);let pg=false,gallery=false,output=`artifacts/acceptance/business-rag-${new Date().toISOString().replace(/[:.]/g,'-')}`,databaseUrlFile='.local-data/rag/database-url';
for(let i=0;i<args.length;i++){if(args[i]==='--pg')pg=true;else if(args[i]==='--gallery')gallery=true;else if(args[i]==='--output'&&args[i+1])output=args[++i];else if(args[i]==='--database-url-file'&&args[i+1])databaseUrlFile=args[++i];else throw Error('BUSINESS_RAG_ARGUMENT_INVALID_NO_LIVE_MODE');}
if(!pg&&databaseUrlFile!=='.local-data/rag/database-url')throw Error('BUSINESS_RAG_DATABASE_FILE_REQUIRES_PG');
await mkdir(output,{recursive:true});
const assets=await readFoodGuidanceAssets();
const provider=pg?await createLocalFoodGuidanceProvider(databaseUrlFile):createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set());
try{
  let snapshot:ContentSnapshot=JSON.parse(await readFile('datasets/health/recipe-research/recipe-snapshot.json','utf8'));
  if(gallery){const directory='.local-data/cloudbase-http/listed-foods-20261026-v28';const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));snapshot=verifyGalleryBundle(JSON.parse(await readFile(join(directory,'gallery-bundle.json'),'utf8')),manifest.hash);}
  const content=contentContext(snapshot),dataset=JSON.parse(await readFile('datasets/evaluation/business-rag-cases-v1.json','utf8'));
  const guidanceResults=[];
  for(const item of dataset.cases){
    const packet=await provider.prepare({profile:{conditions:item.conditions,goals:item.goals,notes:''},content,conditions:item.context});const expected=item.expected;
    const g=expected.factId?packet.guidance.find(g=>g.factId===expected.factId):undefined;
    const passed=(!expected.factId||!!g)&&['direction','objectId','applicability'].every(k=>!expected[k]||(g as any)?.[k]===expected[k])&&(!expected.noDiseaseTopic||!packet.topics.some(t=>t.kind==='condition'))&&(!expected.uncoveredTopic||packet.uncoveredTopics.includes(expected.uncoveredTopic));
    guidanceResults.push({id:item.id,split:item.split,passed,expected,observed:g??null,uncoveredTopics:packet.uncoveredTopics});
  }
  const mapping=await provider.prepare({profile:{conditions:assets.bundle.entities.filter(e=>e.kind==='disease').map(e=>e.name),goals:[],notes:''},content});
  await writeFile(join(output,'mapping-audit.json'),JSON.stringify({contentVersion:content.contentVersion,recipes:content.recipes.length,foods:content.foods.length,diseaseGuidance:mapping.guidance.length,coverage: mapping.mappingCoverage,objects:[...new Set(mapping.guidance.map(g=>g.objectId))].map(objectId=>{const g=mapping.guidance.find(g=>g.objectId===objectId)!;return {objectId,name:g.objectName,...g.mapping};}),scope:'Mapping coverage only; no fabricated shared clinical context or health approval'},null,2)+'\n');
  const scenarios=[
    {id:'real-recipe-hypertension-no-buy',conditions:['高血压'],goals:[],notes:'我是成年人',ingredients:'白菜500g豆腐500g',allowBuy:false,category:'soup',expected:'completed'},
    {id:'real-recipe-fat-loss-method',conditions:[],goals:['减脂'],notes:'我是成年人',ingredients:'白菜500g豆腐500g',allowBuy:false,category:'soup',expected:'completed'},
    {id:'real-recipe-fat-loss-and-lipid',conditions:['高脂血症'],goals:['减脂'],notes:'我是成年人',ingredients:'白菜500g豆腐500g',allowBuy:false,category:'soup',expected:'completed'},
    {id:'real-recipe-missing-no-buy',conditions:['高血压'],goals:[],notes:'我是成年人',ingredients:'白菜500g',allowBuy:false,category:'soup',expected:'no_results',restrictToSoup:true},
    {id:'real-recipe-tofu-allergy',conditions:[],goals:['减脂'],notes:'我是成年人',ingredients:'白菜500g豆腐500g',allowBuy:false,category:'soup',expected:'no_results',allergy:'豆腐',restrictToSoup:true},
    {id:'real-recipe-muscle-unknown-training',conditions:[],goals:['增肌'],notes:'我是成年人',ingredients:'白菜500g豆腐500g',allowBuy:false,category:'soup',expected:'completed'},
    {id:'quantity-small',conditions:['高血压'],goals:['减脂'],notes:'我是成年人',ingredients:'白菜1g豆腐1g',allowBuy:false,category:'soup',expected:'completed'},
    {id:'quantity-large',conditions:['高血压'],goals:['减脂'],notes:'我是成年人',ingredients:'白菜99999g豆腐99999g',allowBuy:false,category:'soup',expected:'completed'},
    ...(gallery?[{id:'new-canonical-flower',conditions:['高脂血症'],goals:['减脂'],notes:'我是成年人',ingredients:'花菜',allowBuy:true,category:'veg',expected:'completed'},
    {id:'new-canonical-baby-cabbage',conditions:['高脂血症'],goals:['减脂'],notes:'我是成年人',ingredients:'娃娃菜',allowBuy:true,category:'veg',expected:'completed'}]:[])
  ];
  // Project-authored scenario expectations; no gold is provided to selector or synthetic supplier.
  const mealResults=[];
  const selectionSecret=randomBytes(32);
  for(const scenario of scenarios){
    const ctx=scenario.restrictToSoup?contentContext({...snapshot,recipes:snapshot.recipes.filter(r=>r.name==='白菜豆腐汤')}):content;
    const parsed=extractText(scenario.ingredients,ctx),meal:Meal={...defaultMeal(),health:true,composition:'custom',counts:{meat:0,veg:scenario.category==='veg'?1:0,soup:scenario.category==='soup'?1:0},allowBuy:scenario.allowBuy,ingredients:parsed.ingredients.map(i=>({...i,status:'confirmed'})),healthProfile:{conditions:scenario.conditions,goals:scenario.goals,notes:scenario.notes,suggestions:[],updatedAt:new Date().toISOString().slice(0,10)}};
    if(scenario.allergy)meal.restrictions=[{id:scenario.id,name:scenario.allergy,kind:'allergy',scope:'self',targets:ctx.restrictionTargets(scenario.allergy),status:'confirmed',original:'构造公开测试限制'}];
    let attempts=0;const packets:unknown[]=[];
    const fetcher:typeof fetch=async(_url,init)=>{
      attempts++;const packet=JSON.parse(JSON.parse(String(init?.body)).messages[1].content);packets.push(packet);
      const grounded=packet.catalog.filter((c:any)=>c.guidanceIds?.length);const chosen=(grounded.length?grounded:packet.catalog).slice(0,packet.count);
      return Response.json({id:'synthetic-business-'+scenario.id,model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:40,total_tokens:140},choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'构造供应商，只验契约',choices:chosen.map((c:any)=>({id:c.id,reason:'构造选菜，不作为真实生成质量',guidanceIds:c.guidanceIds.slice(0,3)}))})}}]});
    };
    let result,error:string|undefined;
    try{result=await createHealthRecipeSelector(selectionSecret,provider)({request:{operationId:scenario.id.startsWith('quantity-')?'00000000-0000-4000-8000-000000000012':crypto.randomUUID(),meal,action:'generate',selected:[],page:0,previous:[]},owner:'synthetic-public-scenario',apiKey:'synthetic-only-not-a-real-key',context:ctx,signal:AbortSignal.timeout(60000),fetcher,present:d=>d,claim:async()=>{},progress:()=>{}});}catch(e){error=e instanceof Error?e.message:'unknown';}
    const actual=result?.status??'error';
    mealResults.push({id:scenario.id,expected:scenario.expected,actual,passed:actual===scenario.expected,error,syntheticSupplierCalls:attempts,result,providerPackets:packets});
  }
  const quantityPackets=mealResults.filter(r=>r.id.startsWith('quantity-')).map(r=>r.providerPackets[0] as {user:unknown;catalog:unknown}|undefined);
  const quantityEquivalent=quantityPackets.length===2&&quantityPackets.every(Boolean)&&JSON.stringify(quantityPackets[0]!.user)===JSON.stringify(quantityPackets[1]!.user)&&JSON.stringify(quantityPackets[0]!.catalog)===JSON.stringify(quantityPackets[1]!.catalog);
  if(!quantityEquivalent)throw Error('BUSINESS_QUANTITY_EQUIVALENCE_FAILED');
  const hashes=await sourceHashes();
  const report={date:new Date().toISOString().slice(0,10),mode:'local_research_structured_RAG_with_synthetic_selection_supplier',realPaidCalls:0,realPg:pg,actualCatalog:{version:content.contentVersion,recipes:content.recipes.length,sha256:guidanceHash(snapshot)},knowledge:{base:assets.bundle.id,goal:assets.goals.id,diseaseFoodGuidance:assets.bundle.facts.filter(f=>f.kind==='food_guidance').length,goalFacts:assets.goals.facts.length,goalEvidence:assets.goals.evidence.length,newGoalVectors:false},dataset:{id:dataset.id,sha256:guidanceHash(dataset),independentHumanReview:false,acceptanceCasesUsedForDebugging:true},guidanceResults,mealResults,passed:guidanceResults.every(r=>r.passed)&&mealResults.every(r=>r.passed),humanQualityReview:'pending; program grounding and project source extraction are not independent clinical review',limitations:['Goal knowledge is a narrow qualitative research slice, not complete sports nutrition or personalized intake planning.','Business path retrieves explicit food guidance; existing vector Q&A remains separate and is not credited for these decisions.','Canonical mappings leave uncertain category, food form and composition cases unmapped.'],sourceFingerprint:sourceFingerprint(hashes),sourceFileCount:Object.keys(hashes).length};
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  await writeFile(join(output,'quantity-equivalence.json'),JSON.stringify({sameOperationIdInFixtureOnly:true,userPacketEqual:true,catalogEqual:true,quantityEquivalent,source:'quantity-small vs quantity-large; fixed selection secret; no real provider'},null,2)+'\n');
  console.log(JSON.stringify({report:join(output,'report.json'),realPg:pg,recipes:content.recipes.length,guidancePassed:guidanceResults.filter(r=>r.passed).length,guidanceTotal:guidanceResults.length,mealResults:mealResults.map(r=>({id:r.id,status:r.actual,passed:r.passed,error:r.error})),realPaidCalls:0}));
  if(!report.passed)process.exitCode=1;
}finally{await provider.close?.();}
}
main().catch(error=>{console.error(error instanceof Error&&/^[A-Z_0-9]+$/.test(error.message)?error.message:'BUSINESS_RAG_EVALUATION_FAILED: local configuration or contract issue; credentials omitted');process.exitCode=1;});
