import { readFile } from 'node:fs/promises';
import type { Database } from '../db';
import { connectDatabase } from '../db';
import { HealthKnowledgeRepository } from '../health-knowledge-repository';
import { canonicalKnowledgeHash } from '../health-knowledge';
import type { NutritionExpansion, CompositionValue } from '../../../shared/nutrition-knowledge';
import { nutritionExpansionVersion, searchNutritionKnowledge, validateNutritionExpansion } from './nutrition-knowledge';

export async function connectLocalNutritionDatabase(urlFile:string){
  const value=(await readFile(urlFile,'utf8')).trim(),url=new URL(value);
  if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!/^\/shiwei_rag_(?:research|test_[a-z0-9_]+)$/.test(url.pathname)||url.searchParams.has('host')||url.searchParams.has('hostaddr'))throw Error('NUTRITION_LOCAL_RESEARCH_DATABASE_REQUIRED');
  return connectDatabase(value,{max:2,queryTimeoutMs:15000});
}
export async function persistNutritionExpansion(db:Database,raw:NutritionExpansion){
  const bundle=validateNutritionExpansion(raw),hash=canonicalKnowledgeHash(bundle);
  await new HealthKnowledgeRepository(db).initializeResearchSchema();
  await db.exec(await readFile(new URL('../health-knowledge/005-nutrition-expansion.sql',import.meta.url),'utf8'));
  const work=async(session:Database)=>{
    await session.exec('BEGIN');
    try{
      if(db.withSession)await session.query('SELECT pg_advisory_xact_lock(1936226167, 29)');
      const existing=(await session.query<{canonical_hash:string;payload:unknown}>('SELECT canonical_hash,payload FROM health_kb.nutrition_releases WHERE id=$1',[bundle.id])).rows[0];
      if(existing){
        if(existing.canonical_hash!==hash||canonicalKnowledgeHash(existing.payload)!==hash)throw Error('NUTRITION_IMMUTABLE_USE_NEW_VERSION');
      }else{
        await session.query('INSERT INTO health_kb.nutrition_releases(id,canonical_hash,payload) VALUES($1,$2,$3::jsonb)',[bundle.id,hash,JSON.stringify(bundle)]);
        const records=bundle.values.map(record=>({food_id:record.foodId,nutrient_id:record.nutrientId,value:record.value,unit:record.unit,status:record.status,record}));
        await session.query(`INSERT INTO health_kb.nutrition_composition(bundle_id,food_id,nutrient_id,value,unit,status,record)
          SELECT $1,x.food_id,x.nutrient_id,x.value,x.unit,x.status,x.record FROM jsonb_to_recordset($2::jsonb)
          AS x(food_id text,nutrient_id text,value numeric,unit text,status text,record jsonb)`,[bundle.id,JSON.stringify(records)]);
      }
      const rows=(await session.query<{record:CompositionValue}>('SELECT record FROM health_kb.nutrition_composition WHERE bundle_id=$1 ORDER BY food_id,nutrient_id',[bundle.id])).rows.map(r=>r.record);
      if(canonicalKnowledgeHash(rows)!==canonicalKnowledgeHash(bundle.values))throw Error('NUTRITION_COMPOSITION_INTEGRITY');
      await session.exec('COMMIT');return {id:bundle.id,imported:!existing,hash,compositionRows:rows.length};
    }catch(error){await session.exec('ROLLBACK');throw error;}
  };
  return db.withSession?db.withSession(work):work(db);
}
export async function loadNutritionExpansion(db:Database,id=nutritionExpansionVersion){
  const row=(await db.query<{canonical_hash:string;payload:unknown}>('SELECT canonical_hash,payload FROM health_kb.nutrition_releases WHERE id=$1',[id])).rows[0];
  if(!row)throw Error('NUTRITION_RELEASE_NOT_FOUND');
  if(canonicalKnowledgeHash(row.payload)!==row.canonical_hash)throw Error('NUTRITION_RELEASE_INTEGRITY');
  return validateNutritionExpansion(row.payload);
}
export async function queryLocalNutritionKnowledge(db:Database,query:string,options:Parameters<typeof searchNutritionKnowledge>[2]={}){
  const bundle=await loadNutritionExpansion(db);
  const {synchronizeLegacyRagRevocations}=await import('../../../scripts/lib/rag-legacy-revocations');
  await synchronizeLegacyRagRevocations(new HealthKnowledgeRepository(db));
  const revoked=new Set([...(options.revoked??[]),...(await db.query<{target_id:string}>('SELECT target_id FROM health_kb.health_revocations')).rows.map(r=>r.target_id)]);
  const result=searchNutritionKnowledge(bundle,query,{...options,revoked});
  // Return values from the normalized SQL rows, verifying exact agreement with the immutable snapshot.
  if(result.foods.length){
    const values=(await db.query<{record:CompositionValue}>('SELECT record FROM health_kb.nutrition_composition WHERE bundle_id=$1 AND food_id=ANY($2::text[])',[bundle.id,result.foods.map(f=>f.food.id)])).rows.map(r=>r.record);
    for(const food of result.foods)for(const value of food.values){const persisted=values.find(v=>v.id===value.id);if(!persisted||canonicalKnowledgeHash(persisted)!==canonicalKnowledgeHash(value))throw Error('NUTRITION_COMPOSITION_INTEGRITY');Object.assign(value,persisted);}
  }
  return result;
}
