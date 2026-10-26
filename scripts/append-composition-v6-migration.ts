import {readFile,writeFile} from 'node:fs/promises';
import {compositionHash,COMPOSITION_BASE_HASH,COMPOSITION_RELEASE} from '../server/composition-review';
async function main(){
  const root='.local-data/cloudbase-http/composition-review-20261024-v6';
  const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
  const payload=JSON.parse(await readFile(`${root}/review-payload.json`,'utf8'));
  if(manifest.releaseId!==COMPOSITION_RELEASE||compositionHash(payload)!==manifest.hash||payload.baseHash!==COMPOSITION_BASE_HASH||manifest.baseHash!==COMPOSITION_BASE_HASH)throw Error('V6_MANIFEST_MISMATCH');
  const sql=`-- Append-only repair: the 20261024060000 ledger entry has no public v6 row; publish the verified immutable payload with a new migration version.\nINSERT INTO public.shiwei_gallery_releases(release_id,checksum,payload,published) VALUES('${COMPOSITION_RELEASE}','${manifest.hash}','${JSON.stringify(payload).replaceAll("'","''")}'::jsonb,true);\n`;
  await writeFile(`${root}/migration/cloudbase/migrations/20261024070000_composition_ingredient_scope_release.sql`,sql,{flag:'wx'});
  console.log(JSON.stringify({migrationAdded:true,version:'20261024070000',releaseId:COMPOSITION_RELEASE,hash:manifest.hash,oldMigrationPreserved:true}));
}
main().catch(error=>{console.error('V6_APPEND_MIGRATION_FAILED',error.name);process.exitCode=1;});
