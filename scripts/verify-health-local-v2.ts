import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { HealthKnowledgeRepository } from '../backend/src/health-knowledge-repository';
import type { Database } from '../backend/src/db';
const root=fileURLToPath(new URL('..', import.meta.url));
const legacyPath=join(root,'.local-data/health-knowledge/2026-10-28-v1');
let legacyRevocations:{target_id:string;reason:string}[]=[];
if(existsSync(legacyPath)){
  const legacy=new PGlite(legacyPath);
  try{legacyRevocations=(await legacy.query<{target_id:string;reason:string}>('SELECT target_id,reason FROM health_kb.health_revocations')).rows;}
  finally{await legacy.close();}
}
const engine=new PGlite(join(root,'.local-data/health-knowledge/shared'));
const db:Database={query:(s,p)=>engine.query(s,p),exec:async s=>{await engine.exec(s);},close:()=>engine.close()};
try{
  const repo=new HealthKnowledgeRepository(db);
  for(const r of legacyRevocations)await repo.withdraw(r.target_id,r.reason);
  const bundle=await repo.load('health-kb-2026-10-28-v2');
  const versions=(await db.query<{id:string}>('SELECT id FROM health_kb.health_releases ORDER BY id')).rows.map(r=>r.id);
  const queries=['高血脂可以选择不饱和脂肪酸吗','慢性肾病低蛋白大米','原发性骨质疏松症牛奶'];
  const examples=[];
  for(const query of queries){const r=await repo.search(bundle.id,query);examples.push({query,state:r.state,executionAllowed:r.executionAllowed,index:r.index,revocationWatermark:r.revocationWatermark,hits:r.hits.slice(0,3).map(h=>({factId:h.fact.id,applicability:h.applicability,citations:h.citations}))});}
  const report={state:'persisted_verified',versions,counts:{sources:bundle.sources.length,evidence:bundle.evidence.length,facts:bundle.facts.length,ruleDrafts:bundle.ruleDrafts.length},diseaseTopics:bundle.entities.filter(e=>e.kind==='disease').map(e=>({id:e.id,name:e.name})),migratedLegacyRevocations:legacyRevocations.length,currentRevocations:(await db.query('SELECT target_id FROM health_kb.health_revocations')).rows.length,examples,clinicalRelease:null,onlineEnabled:false};
  const dir=join(root,'artifacts/acceptance/health-knowledge-2026-10-28-v2');await mkdir(dir,{recursive:true});await writeFile(join(dir,'persisted-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({state:report.state,versions,counts:report.counts,migratedLegacyRevocations:report.migratedLegacyRevocations,currentRevocations:report.currentRevocations},null,2));
}finally{await db.close();}
