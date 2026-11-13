import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readFoodGuidanceAssets, createLocalFoodGuidanceProvider } from '../backend/src/rag/food-guidance-repository';
import { createFoodGuidanceProvider, bindRecipeGuidance } from '../backend/src/rag/food-guidance';
import { createNutritionGuidanceProvider } from '../backend/src/rag/nutrition-guidance-provider';
import { connectLocalNutritionDatabase, queryLocalNutritionKnowledge } from '../backend/src/rag/nutrition-knowledge-repository';
import { searchNutritionKnowledge } from '../backend/src/rag/nutrition-knowledge';
import { verifyGalleryBundle } from '../backend/src/cloudbase-content';
import { contentContext } from '../shared/content';
import { canonicalKnowledgeHash } from '../backend/src/health-knowledge';
import { sourceHashes, sourceFingerprint } from './lib/source-fingerprint';

async function main(){
  const args=process.argv.slice(2);let databaseFile='',galleryDir='',output='artifacts/acceptance/nutrition-expansion-2026-11-13/structured';
  for(let i=0;i<args.length;i++){if(!args[i+1])throw Error('NUTRITION_EVALUATION_ARGUMENT_INVALID');if(args[i]==='--database-url-file')databaseFile=args[++i];else if(args[i]==='--gallery-dir')galleryDir=args[++i];else if(args[i]==='--output')output=args[++i];else throw Error('NUTRITION_EVALUATION_ARGUMENT_INVALID');}
  const assets=await readFoodGuidanceAssets(),revocations=async()=>new Set<string>();
  const provider=databaseFile?await createLocalFoodGuidanceProvider(databaseFile):createNutritionGuidanceProvider(createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,revocations),assets.expansion,revocations);
  const snapshot=galleryDir?verifyGalleryBundle(JSON.parse(await readFile(join(galleryDir,'gallery-bundle.json'),'utf8')),JSON.parse(await readFile(join(galleryDir,'manifest.json'),'utf8')).hash):JSON.parse(await readFile('datasets/health/recipe-research/recipe-snapshot.json','utf8'));
  const content=contentContext(snapshot);
  const scenarios=[
    {id:'constipation',d:['便秘'],g:[],c:{adult:'yes'},fact:'nx-fact:constipation-veg',state:'applicable'},
    {id:'gerd-unknown',d:['胃食管反流病'],g:[],c:{adult:'yes'},fact:'nx-fact:gerd-tomato',state:'needs_confirmation'},
    {id:'gerd-personal-tomato',d:['胃食管反流病'],g:[],c:{adult:'yes',gerdTriggerTomato:'yes'},fact:'nx-fact:gerd-tomato',state:'applicable'},
    {id:'lactose-tolerance-unknown',d:['乳糖不耐受'],g:[],c:{adult:'yes'},fact:'nx-fact:lactose-yogurt',state:'needs_confirmation'},
    {id:'nafld',d:['非酒精性脂肪肝'],g:[],c:{adult:'yes'},fact:'nx-fact:nafld-sugary',state:'applicable'},
    {id:'iron-deficiency',d:['缺铁性贫血'],g:[],c:{adult:'yes'},fact:'nx-fact:anemia-iron',state:'applicable'},
    {id:'maintain-weight',d:[],g:['维持体重'],c:{adult:'yes'},fact:'nx-fact:weight-maintenance-wholegrains',state:'applicable'},
    {id:'gain-weight-unintentional-loss',d:[],g:['健康增重'],c:{adult:'yes',unintentionalWeightLoss:'yes'},fact:'nx-fact:gain-calories',state:'not_applicable'},
    {id:'recovery-healthy',d:[],g:['运动恢复'],c:{adult:'yes',healthyExerciser:'yes',exerciseTraining:'yes'},fact:'nx-fact:exercise-recovery-protein',state:'applicable'},
    {id:'muscle-with-gout',d:['痛风'],g:['增肌'],c:{adult:'yes',healthyExerciser:'yes',resistanceTraining:'yes'},fact:'nx-fact:muscle-gain-protein',state:'not_applicable'},
  ];
  const guidanceResults=[];
  try{
    for(const scenario of scenarios){
      const conditions=Object.fromEntries(Object.entries(scenario.c).filter((entry):entry is [string,string]=>typeof entry[1]==='string'));
      const packet=await provider.prepare({profile:{conditions:scenario.d,goals:scenario.g,notes:''},content,conditions});
      await provider.assertCurrent(packet);
      const fact=packet.guidance.find(g=>g.factId===scenario.fact);
      const evidenceClosed=packet.guidance.filter(g=>g.applicability!=='withdrawn').every(g=>[...g.evidenceIds,...g.qualifyingEvidenceIds].every(id=>packet.evidence.some(e=>e.id===id)));
      const bindings=content.recipes.flatMap(r=>r.variants.map(v=>bindRecipeGuidance(packet,content,r,v))).filter(b=>b.matches.some(m=>m.guidanceId===`guide:${scenario.fact}`));
      guidanceResults.push({id:scenario.id,expected:scenario.state,actual:fact?.applicability,passed:fact?.applicability===scenario.state&&evidenceClosed,evidenceClosed,mappedFoodIds:fact?.mapping.foodIds??[],boundRecipeVariants:bindings.length,exampleBinding:bindings[0]??null});
    }
    const db=databaseFile?await connectLocalNutritionDatabase(databaseFile):undefined;
    const queryResults=[];
    try{
      for(const query of ['生西兰花维生素C','干香菇维生素D','维生素B12','维生素B7','增肌','健康增重']){
        const result=db?await queryLocalNutritionKnowledge(db,query):searchNutritionKnowledge(assets.expansion,query);
        queryResults.push({id:query,passed:result.foods.length>0,nutrients:result.nutrients.map(n=>n.id),firstFoods:result.foods.slice(0,3).map(f=>({name:f.food.name,form:f.food.form,basis:f.food.basis,values:f.values.map(v=>({nutrientId:v.nutrientId,value:v.value,unit:v.unit,status:v.status,csvRow:v.csvRow}))})),pendingRules:result.facts.filter(f=>f.applicability==='needs_confirmation').length});
      }
      const source=assets.expansion.sources.find(s=>s.id==='usda-sr-2018')!;
      const withdrawn=db?await queryLocalNutritionKnowledge(db,'维生素C',{revoked:new Set([source.sourceHash])}):searchNutritionKnowledge(assets.expansion,'维生素C',{revoked:new Set([source.sourceHash])});
      queryResults.push({id:'source-hash-revocation',passed:withdrawn.foods.length===0,simulatedInMemory:true,persistedGlobalRevocationsChanged:false});
    }finally{await db?.close();}
    const hashes=await sourceHashes(),report={date:'2026-11-13',mode:'project_authored_public_local_acceptance',realPostgres:Boolean(databaseFile),actualCatalog:{version:content.contentVersion,recipes:content.recipes.length,foods:content.foods.length,hash:canonicalKnowledgeHash(snapshot)},expansion:{id:assets.expansion.id,hash:canonicalKnowledgeHash(assets.expansion)},guidanceResults,queryResults,passed:guidanceResults.every(r=>r.passed)&&queryResults.every(r=>r.passed),newVectors:false,realPaidCalls:0,independentClinicalReview:false,sourceFingerprint:sourceFingerprint(hashes)};
    await mkdir(output,{recursive:true});await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({passed:report.passed,realPostgres:report.realPostgres,recipes:content.recipes.length,guidance:guidanceResults.map(r=>({id:r.id,passed:r.passed,boundRecipeVariants:r.boundRecipeVariants})),queries:queryResults.map(r=>({id:r.id,passed:r.passed}))},null,2));
    if(!report.passed)process.exitCode=1;
  }finally{await provider.close?.();}
}
main().catch(error=>{console.error(error instanceof Error&&/^[A-Z_0-9]+$/.test(error.message)?error.message:'NUTRITION_EVALUATION_FAILED_CREDENTIALS_OMITTED');process.exitCode=1;});
