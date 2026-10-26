import { readFile,writeFile,mkdir,cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { verifyGalleryBundle,galleryBundleHash } from '../server/cloudbase-content';
import { buildCompositionRelease,compositionHash,COMPOSITION_RELEASE,COMPOSITION_BASE_HASH,reviewedDefinitions,applyCompositionRelease } from '../server/composition-review';

async function main(){
  const root='.local-data/cloudbase-http/composition-review-20261024-v1';
  await mkdir(root,{recursive:false});
  const bundle=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261023/gallery-bundle.json','utf8'));
  if(galleryBundleHash(bundle)!==COMPOSITION_BASE_HASH)throw Error('BASE_RELEASE_CHANGED');
  const snapshot=verifyGalleryBundle(bundle,COMPOSITION_BASE_HASH),payload=buildCompositionRelease(snapshot),hash=compositionHash(payload);
  applyCompositionRelease(snapshot,payload,hash);
  for(const definition of reviewedDefinitions){
    if(createHash('sha256').update(await readFile(`acceptance/account-ingredients-2026-10-24/${definition.sourceRecord}-source.md`)).digest('hex')!==definition.sourceSha256)throw Error('SOURCE_CHANGED');
  }
  await writeFile(`${root}/review-payload.json`,JSON.stringify(payload,null,2),{flag:'wx'});
  const sql=`-- Only the two individually checked original recipes receive composition approvals.\n-- No food completeness flags, existing releases, private data or permissions are changed.\nINSERT INTO public.shiwei_gallery_releases(release_id,checksum,payload,published) VALUES ('${COMPOSITION_RELEASE}','${hash}','${JSON.stringify(payload).replaceAll("'","''")}'::jsonb,true);\n`;
  const db=new PGlite();
  try{
    await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;');
    await db.exec(await readFile('deploy/db/gallery-http-release.sql','utf8'));await db.exec(sql);
    await db.exec('SET ROLE anon');
    const result=await db.query<{payload:typeof payload}>('SELECT payload FROM shiwei_gallery_releases');
    if(compositionHash(result.rows[0].payload)!==hash)throw Error('SQL_ROUNDTRIP');
    let denied=false;try{await db.exec('UPDATE shiwei_gallery_releases SET published=false');}catch{denied=true;}if(!denied)throw Error('ANON_WRITE');
  }finally{await db.close();}
  await cp('.local-data/cloudbase-http/account-ingredients-20261024-v2/migration',`${root}/migration`,{recursive:true});
  await writeFile(`${root}/migration/cloudbase/migrations/20261024020000_composition_review.sql`,sql,{flag:'wx'});
  const report={releaseId:COMPOSITION_RELEASE,hash,baseHash:COMPOSITION_BASE_HASH,variantRecords:payload.records.length,verifiedRecipes:payload.records.filter(r=>r.state==='verified-composition').map(r=>r.recipeId),pendingRecords:payload.records.filter(r=>r.state==='pending-source-review').length,globalCompletenessChanged:false,unknownCompoundStillBlocked:true,nutritionInferred:false,sqlRoundTrip:true,anonWriteDenied:true};
  await writeFile(`${root}/manifest.json`,JSON.stringify(report,null,2),{flag:'wx'});
  await writeFile('acceptance/account-ingredients-2026-10-24/composition-inventory.json',JSON.stringify(payload,null,2),{flag:'wx'});
  await writeFile('acceptance/account-ingredients-2026-10-24/composition-release.json',JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify(report));
}
main().catch(error=>{console.error('COMPOSITION_PREPARE_FAILED',error.name);process.exitCode=1;});
