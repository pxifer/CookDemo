/** Fixed public-source checks; no API key, personal query or paid generation entry. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {connectDatabase} from '../backend/src/db';
import {readFoodGuidanceAssets,persistGuidanceAssets} from '../backend/src/rag/food-guidance-repository';
import {createFoodGuidanceProvider,bindRecipeGuidance} from '../backend/src/rag/food-guidance';
import {canonicalKnowledgeHash,sha256} from '../backend/src/health-knowledge';
import {knownEvidenceWithdrawalIds} from '../backend/src/health-knowledge-policy';
import {LocalEmbeddingProvider} from '../backend/src/rag/embedding';
import {PgRagVectorStore} from '../backend/src/rag/storage';
import {answerRag,ExtractiveFixtureGenerator} from '../backend/src/rag/pipeline';
import {contentContext} from '../shared/content';
import {verifyGalleryBundle} from '../backend/src/cloudbase-content';
import type {EvidenceVector,RagQuestion} from '../backend/src/rag/types';
import {assertLocalTestDatabase} from './lib/local-test-config';

let stage='arguments';
async function main(){
 const values=new Map<string,string>(),args=process.argv.slice(2);
 const allowed=new Set(['--database-url-file','--embedding-url','--gallery-directory','--output','--mode']);
 for(let i=0;i<args.length;i++){const key=args[i],value=args[++i];if(!allowed.has(key)||values.has(key)||!value||value.startsWith('--'))throw Error('REFRESH_ARGUMENT_INVALID');values.set(key,value);}
 const mode=values.get('--mode')??'persist';
 if(!['prepare','persist'].includes(mode)||!values.has('--embedding-url')||mode==='persist'&&!values.has('--database-url-file'))throw Error('REFRESH_LOCAL_PG_AND_EMBEDDING_REQUIRED');
 const output=resolve(values.get('--output')??'artifacts/acceptance/rag-evidence-refresh-2026-11-12');
 if(output!==resolve('artifacts/acceptance/rag-evidence-refresh-2026-11-12')&&!output.startsWith(resolve('.local-data')+'/')&&!output.startsWith(resolve('.local-data')+'\\'))throw Error('REFRESH_OUTPUT_SCOPE_INVALID');
 const embedding=new LocalEmbeddingProvider(values.get('--embedding-url'));
 const assets=await readFoodGuidanceAssets(),cacheFile='.local-data/evidence-refresh/qwen-v3-vectors.json';
 const encode=async()=>{
  const identity=await embedding.describe();
  if(identity.modelId!=='Qwen/Qwen3-Embedding-0.6B'||identity.revision!=='97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3'||identity.dimensions!==1024)throw Error('REFRESH_EXPECTED_MODEL_REQUIRED');
  if(existsSync(cacheFile)){
   const cached=JSON.parse(await readFile(cacheFile,'utf8'));
   if(cached.bundleHash!==canonicalKnowledgeHash(assets.bundle)||canonicalKnowledgeHash(cached.identity)!==canonicalKnowledgeHash(identity)||cached.rows.length!==assets.bundle.evidence.length)throw Error('REFRESH_VECTOR_CACHE_MISMATCH');
   return cached as {identity:typeof identity;bundleHash:string;rows:EvidenceVector[]};
  }
  const rows:EvidenceVector[]=[];
  for(let start=0;start<assets.bundle.evidence.length;start+=8){
   const evidence=assets.bundle.evidence.slice(start,start+8),batch=await embedding.embed(evidence.map(e=>e.retrievalText),'document');
   evidence.forEach((e,i)=>rows.push({evidenceId:e.id,textHash:sha256(e.retrievalText),vector:batch.vectors[i]}));
  }
  const result={identity,bundleHash:canonicalKnowledgeHash(assets.bundle),rows};await mkdir(resolve('.local-data/evidence-refresh'),{recursive:true});await writeFile(cacheFile,JSON.stringify(result)+'\n',{flag:'wx'});return result;
 };
 if(mode==='prepare'){
  stage='embedding-documents';const vectors=await encode();
  console.log(JSON.stringify({mode:'real_local_embedding_prepared_only',bundle:assets.bundle.id,vectors:vectors.rows.length,dimensions:vectors.identity.dimensions,pgImported:false,cacheFile,paidGenerationCalls:0}));return;
 }
 stage='local-configuration';
 const url=(await readFile(values.get('--database-url-file')!,'utf8')).trim();assertLocalTestDatabase(url);
 if(!/^\/shiwei_rag_(research|test_[a-z0-9_]+)$/.test(new URL(url).pathname))throw Error('REFRESH_RESEARCH_DATABASE_REQUIRED');
 const db=await connectDatabase(url,{max:2,queryTimeoutMs:30000});
 try{
  stage='persist-guidance';
  const repository=await persistGuidanceAssets(db,assets);const loaded=await repository.load(assets.bundle.id);
  if(canonicalKnowledgeHash(loaded)!==canonicalKnowledgeHash(assets.bundle))throw Error('REFRESH_PERSISTED_HASH_MISMATCH');
  const store=new PgRagVectorStore(db);await store.initialize();
  const indexId='qwen-20261112-v3-body-r1';
  const archived=async()=> (await db.query('SELECT id,bundle_id,payload_hash,expected_chunks FROM health_kb.vector_index_manifests WHERE id<>$1 ORDER BY id',[indexId])).rows;
  stage='embedding-health';
  const before=await archived(),identity=await embedding.describe();
  if(identity.modelId!=='Qwen/Qwen3-Embedding-0.6B'||identity.dimensions!==1024)throw Error('REFRESH_EXPECTED_MODEL_REQUIRED');
  const exists=(await db.query('SELECT id FROM health_kb.vector_index_manifests WHERE id=$1',[indexId])).rows.length>0;
  if(!exists){
   stage='embedding-documents';const vectors=await encode();
   stage='publish-index';await store.putIndex(indexId,assets.bundle,vectors.identity,vectors.rows);
  }
  const manifest=await store.manifest(indexId);
  if(manifest.bundleId!==assets.bundle.id||manifest.bundleHash!==canonicalKnowledgeHash(assets.bundle)||manifest.chunks!==99||canonicalKnowledgeHash(manifest.identity)!==canonicalKnowledgeHash(identity))throw Error('REFRESH_INDEX_IDENTITY_MISMATCH');
  if(JSON.stringify(before)!==JSON.stringify(await archived()))throw Error('REFRESH_ARCHIVED_INDEX_CHANGED');
  const fact=assets.bundle.facts.find(f=>f.id==='fact:microwave-hca')!;
  const conditions={inputFoodClass:'muscle_meat',subsequentHighHeatShortened:'yes',microwavePreheating:'yes'};
  stage='retrieval-checks';const checks=[];
  for(const mode of ['a1','dense','hybrid'] as const){
   const request:RagQuestion={question:'微波预熟肌肉肉类怎样减少杂环胺形成',context:conditions,requiredEvidenceIds:fact.evidenceIds,mode};
   const result=await answerRag(assets.bundle,store,embedding,new ExtractiveFixtureGenerator(),indexId,request);
   const passed=result.status==='answered'&&result.context?.facts.some(h=>h.fact.id===fact.id)&&[...fact.evidenceIds,...fact.qualifyingEvidenceIds].every(id=>result.context?.evidence.some(e=>e.evidence.id===id))&&!result.invocation;
   checks.push({id:'qualified-'+mode,passed:Boolean(passed),status:result.status,factIds:result.context?.facts.map(h=>h.fact.id),evidenceIds:result.context?.evidence.map(e=>e.evidence.id),reason:result.reason??null});
  }
  for(const [id,request] of [
   ['unknown-preheating',{question:'微波预熟肌肉肉类杂环胺',context:{...conditions,microwavePreheating:'unknown'}}],
   ['legacy-navigation-required',{question:'微波预熟杂环胺',context:conditions,requiredEvidenceIds:[knownEvidenceWithdrawalIds[0]]}],
  ] satisfies [string,RagQuestion][]){
   const result=await answerRag(assets.bundle,store,embedding,new ExtractiveFixtureGenerator(),indexId,request);
   checks.push({id,passed:result.status==='needs_confirmation'||result.status==='insufficient_evidence',status:result.status,reason:result.reason??null});
  }
  stage='catalog-mapping';const directory=values.get('--gallery-directory')??'.local-data/cloudbase-http/listed-foods-20261026-v28';
  const galleryManifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
  const snapshot=verifyGalleryBundle(JSON.parse(await readFile(join(directory,'gallery-bundle.json'),'utf8')),galleryManifest.hash),content=contentContext(snapshot);
  const previous=await readFoodGuidanceAssets(2),profile={conditions:['高血压','高脂血症'],goals:['减脂'],notes:'我是成年人'};
  const prepare=(a:typeof assets)=>createFoodGuidanceProvider(a.bundle,a.goals,a.mappings,async()=>new Set()).prepare({profile,content});
  const [oldPacket,newPacket]=await Promise.all([prepare(previous),prepare(assets)]);
  const coverage=(packet:typeof newPacket)=>content.recipes.flatMap(recipe=>recipe.variants.map(variant=>({recipeId:recipe.id,variantId:variant.id,name:recipe.name,matches:bindRecipeGuidance(packet,content,recipe,variant).matches.length})));
  const [oldRows,newRows]=[coverage(oldPacket),coverage(newPacket)];
  const gained=newRows.filter((row,i)=>row.matches>oldRows[i].matches);
  const report={date:'2026-11-12',mode:'real_loopback_pg_and_local_qwen_with_extractive_fixture_only',knowledgeId:assets.bundle.id,knowledgeHash:canonicalKnowledgeHash(loaded),counts:assets.manifest.counts,
   index:manifest,archivedIndexesUnchanged:true,knownWithdrawals:knownEvidenceWithdrawalIds,checks,paidGenerationCalls:0,clinicalRelease:null,independentQualityScore:null,
   mapping:{from:previous.mappings.id,to:assets.mappings.id,catalogVersion:content.contentVersion,recipes:content.recipes.length,variants:newRows.length,
    beforeGroundedVariants:oldRows.filter(r=>r.matches).length,afterGroundedVariants:newRows.filter(r=>r.matches).length,variantsWithAdditionalBindings:gained.length,gained,
    scope:'Mapping/binding coverage on a fixed public cache only; not medical accuracy, user satisfaction or online catalog coverage.'},passed:checks.every(c=>c.passed)};
  await mkdir(output,{recursive:true});await writeFile(join(output,'storage-and-mapping.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({report:join(output,'storage-and-mapping.json'),vectors:manifest.chunks,checks:checks.map(c=>({id:c.id,passed:c.passed,status:c.status})),mappingBefore:report.mapping.beforeGroundedVariants,mappingAfter:report.mapping.afterGroundedVariants,paidGenerationCalls:0}));
  if(!report.passed)process.exitCode=1;
 }finally{await db.close();}
}
main().catch(error=>{const raw=error?.code??(error instanceof Error?error.message:'');const code=typeof raw==='string'&&/^[A-Z_0-9]{1,100}$/.test(raw)?raw:'LOCAL_SERVICE_OR_CONTRACT_ERROR';console.error(JSON.stringify({error:'REFRESH_VERIFICATION_FAILED',stage,code,credentialsOmitted:true}));process.exitCode=1;});
