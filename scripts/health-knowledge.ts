import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join, basename } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from '../backend/src/db';
import { HealthKnowledgeRepository } from '../backend/src/health-knowledge-repository';
import { searchKnowledge, sha256, validateKnowledgeBundle } from '../backend/src/health-knowledge';

const root = fileURLToPath(new URL('..', import.meta.url));
const catalog = JSON.parse(await readFile(join(root,'datasets/health/catalog.json'),'utf8'));
const input=process.argv.slice(2), flag=input.indexOf('--bundle');
const version=flag>=0?input[flag+1]:catalog.defaultBundle;
if(flag>=0)input.splice(flag,2);
if(!catalog.versions.includes(version)||!/^\d{4}-\d{2}-\d{2}-v\d+$/.test(version))throw new Error('HEALTH_BUNDLE_VERSION_UNKNOWN');
const dir = join(root,'datasets/health',version);
const manifest = JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
for (const [name,hash] of Object.entries(manifest.files)) {
  if (basename(name) !== name || sha256(await readFile(join(dir,name))) !== hash) throw new Error('HEALTH_MANIFEST_HASH_MISMATCH');
}
const raw = JSON.parse(await readFile(join(dir,'knowledge-bundle.json'),'utf8'));
const bundle = validateKnowledgeBundle(raw);
const [command='verify',...args] = input;
if (!['verify','import-local','query','query-local'].includes(command)) throw new Error('Usage: verify | import-local | query <text> | query-local <text>');
if (command === 'verify') {
  console.log(JSON.stringify({state:'verified',id:bundle.id,counts:manifest.counts,clinicalRelease:null},null,2));
} else if (command === 'query') {
  console.log(JSON.stringify(searchKnowledge(bundle,args.join(' ')),null,2));
} else {
  const localDir = resolve(root,'.local-data/health-knowledge/shared');
  await mkdir(localDir,{recursive:true});
  const engine = new PGlite(localDir);
  const db: Database = {query:(sql,params)=>engine.query(sql,params),exec:async sql=>{await engine.exec(sql);},close:()=>engine.close()};
  const repo = new HealthKnowledgeRepository(db);
  try {
    if (command === 'import-local') {
      await repo.initializeResearchSchema();
      const result = await repo.importResearch(bundle,manifest);
      const report = {state:'local_research_imported',...result,counts:manifest.counts,databasePath:localDir,clinicalRelease:null,onlineEnabled:false};
      const reportDirectory=join(root,`artifacts/acceptance/health-knowledge-${version}`);
      await mkdir(reportDirectory,{recursive:true});
      await writeFile(join(reportDirectory,`local-import-${version}.json`),JSON.stringify(report,null,2)+'\n');
      console.log(JSON.stringify(report,null,2));
    } else {
      console.log(JSON.stringify(await repo.search(bundle.id,args.join(' ')),null,2));
    }
  } finally { await db.close(); }
}
