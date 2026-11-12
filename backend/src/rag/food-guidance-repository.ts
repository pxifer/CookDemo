import { readFile } from 'node:fs/promises';
import { connectDatabase, type Database } from '../db';
import { HealthKnowledgeRepository } from '../health-knowledge-repository';
import { canonicalKnowledgeHash, sha256 } from '../health-knowledge';
import { readKnowledgeAssets } from '../health-knowledge-assets';
import { createFoodGuidanceProvider, type GoalKnowledge, type GuidanceMappings } from './food-guidance';
import type { FoodGuidanceProvider } from '../../../shared/food-guidance';

const data=(path:string)=>new URL(`../../../datasets/health/${path}`,import.meta.url);
export async function readFoodGuidanceAssets(mappingVersion:1|2|3=3){
  if(mappingVersion!==1&&mappingVersion!==2&&mappingVersion!==3)throw Error('GUIDANCE_MAPPING_VERSION_INVALID');
  const {bundle,manifest}=await readKnowledgeAssets();
  const goalManifest=JSON.parse(await readFile(data('goal-guidance-2026-11-04-v1/manifest.json'),'utf8'));
  const raw=await readFile(data('goal-guidance-2026-11-04-v1/knowledge.json'));
  if(sha256(raw)!==goalManifest.files['knowledge.json'])throw Error('GUIDANCE_GOAL_INTEGRITY');
  const goals=JSON.parse(raw.toString('utf8')) as GoalKnowledge;
  const mappings=JSON.parse(await readFile(data(`food-guidance-mappings-v${mappingVersion}.json`),'utf8')) as GuidanceMappings;
  if(mappings.id!==`food-guidance-mappings-v${mappingVersion}`)throw Error('GUIDANCE_MAPPING_ID_INVALID');
  if(goals.id!==goalManifest.id||!goals.facts.length||new Set(goals.facts.map(f=>f.id)).size!==goals.facts.length)throw Error('GUIDANCE_ASSETS_INVALID');
  for(const f of goals.facts)if(!['prefer','limit','avoid'].includes(f.direction)||!goals.topics.some(t=>t.id===f.topicId)||[...f.evidenceIds,...f.qualifyingEvidenceIds].some(id=>!goals.evidence.some(e=>e.id===id)))throw Error('GUIDANCE_ASSETS_INVALID');
  return {bundle,manifest,goals,mappings};
}
export async function persistGuidanceAssets(db:Database,assets:Awaited<ReturnType<typeof readFoodGuidanceAssets>>){
  const repository=new HealthKnowledgeRepository(db);await repository.initializeResearchSchema();await repository.importResearch(assets.bundle,assets.manifest);
  await db.exec(await readFile(new URL('../health-knowledge/004-food-guidance-assets.sql',import.meta.url),'utf8'));
  for(const [kind,payload] of [['goal_knowledge',assets.goals],['food_mapping',assets.mappings]] as const){
    const raw=JSON.stringify(payload),hash=sha256(raw);
    await db.query('INSERT INTO health_kb.guidance_assets(id,kind,sha256,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING',[payload.id,kind,hash,raw]);
    const row=(await db.query<{sha256:string;payload:unknown}>('SELECT sha256,payload FROM health_kb.guidance_assets WHERE id=$1 AND kind=$2',[payload.id,kind])).rows[0];
    if(!row||row.sha256!==hash||canonicalKnowledgeHash(row.payload)!==canonicalKnowledgeHash(payload))throw Error('GUIDANCE_ASSET_IMMUTABLE_USE_NEW_VERSION');
  }
  return repository;
}
export async function createLocalFoodGuidanceProvider(urlFile='.local-data/rag/database-url'):Promise<FoodGuidanceProvider>{
  const value=(await readFile(urlFile,'utf8')).trim(),url=new URL(value);
  if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!/^\/shiwei_rag_(?:research|test_[a-z0-9_]+)$/.test(url.pathname)||url.searchParams.has('host')||url.searchParams.has('hostaddr'))throw Error('GUIDANCE_LOCAL_RESEARCH_DATABASE_REQUIRED');
  const db=await connectDatabase(value,{max:2,queryTimeoutMs:15000});
  try{
    const assets=await readFoodGuidanceAssets();await persistGuidanceAssets(db,assets);
    // Every read merges the legacy global research revocations; no truncation/reset.
    let tail:Promise<unknown>=Promise.resolve();
    const readRevocations=async()=>{
      const {synchronizeLegacyRagRevocations}=await import('../../../scripts/lib/rag-legacy-revocations');
      await synchronizeLegacyRagRevocations(new HealthKnowledgeRepository(db));
      return new Set((await db.query<{target_id:string}>('SELECT target_id FROM health_kb.health_revocations')).rows.map(r=>r.target_id));
    };
    const revocations=()=>{const work=tail.then(readRevocations,readRevocations);tail=work.catch(()=>{});return work;};
    return {...createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,revocations),close:()=>db.close()};
  }catch(error){await db.close();throw error;}
}
