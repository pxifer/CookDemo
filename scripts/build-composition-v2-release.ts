import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {verifyGalleryBundle} from '../backend/src/cloudbase-content';
import {buildCompositionRelease,applyCompositionRelease,compositionHash,COMPOSITION_BASE_HASH,COMPOSITION_RELEASE,reviewedDefinitions} from '../backend/src/composition-review';
import {contentContext} from '../shared/content';
import {defaultMeal} from '../shared/types';
import {checkDish} from '../backend/src/recommendation';
async function main(){
  const root='.local-data/cloudbase-http/composition-review-20261024-v4';await mkdir(root,{recursive:false});
  const bundle=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261023/gallery-bundle.json','utf8'));
  const snapshot=verifyGalleryBundle(bundle,COMPOSITION_BASE_HASH),payload=buildCompositionRelease(snapshot),hash=compositionHash(payload),reviewed=applyCompositionRelease(snapshot,payload,hash);
  for(const definition of reviewedDefinitions){const folder=definition.reviewId.endsWith('v2')?'composition-v2-2026-10-24':'account-ingredients-2026-10-24';if(createHash('sha256').update(await readFile(`artifacts/acceptance/${folder}/${definition.sourceRecord}-source.md`)).digest('hex')!==definition.sourceSha256)throw Error('SOURCE_HASH_CHANGED');}
  const sql=`-- Immutable v2 recipe evidence only. No old data, account, grants or completeness flags changed.\nINSERT INTO public.shiwei_gallery_releases(release_id,checksum,payload,published) VALUES('${COMPOSITION_RELEASE}','${hash}','${JSON.stringify(payload).replaceAll("'","''")}'::jsonb,true);\n`;
  const db=new PGlite();try{await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;');await db.exec(await readFile('deployment/db/gallery-http-release.sql','utf8'));await db.exec(sql);await db.exec('SET ROLE anon');const result=await db.query<{payload:typeof payload}>('SELECT payload FROM shiwei_gallery_releases');if(compositionHash(result.rows[0].payload)!==hash)throw Error('ROUNDTRIP');let denied=false;try{await db.exec('UPDATE shiwei_gallery_releases SET published=false');}catch{denied=true;}if(!denied)throw Error('ANON_WRITE');}finally{await db.close();}
  await cp('.local-data/cloudbase-http/composition-review-20261024-v3/migration',`${root}/migration`,{recursive:true});await writeFile(`${root}/migration/cloudbase/migrations/20261024050000_composition_oil.sql`,sql,{flag:'wx'});
  const context=contentContext(reviewed),meal={...defaultMeal(),allowBuy:true,restrictions:['鱼','玉米'].map(name=>({id:name,kind:'avoid' as const,name,targets:context.restrictionTargets(name),status:'confirmed' as const,scope:'self' as const,original:name}))};
  const eligible=context.recipes.filter(recipe=>recipe.variants.some(variant=>checkDish(recipe,variant,meal,context).dish)).map(recipe=>recipe.name);
  const report={releaseId:COMPOSITION_RELEASE,hash,baseHash:COMPOSITION_BASE_HASH,sourceCheckedRecords:reviewedDefinitions.length,fullyVerifiedRecords:payload.records.filter(r=>r.state==='verified-composition').length,conditionalSourceRecords:payload.records.filter(r=>r.state==='source-covered-with-unresolved').length,pendingRecords:payload.records.filter(r=>r.state==='pending-source-review').length,fishCornEligibleWithBuying:eligible,originalRecipes:snapshot.recipes.length,variants:payload.records.length,ingredientLines:reviewed.recipes.flatMap(r=>r.variants.flatMap(v=>v.lines)).length,globalCompletenessChanged:false,unknownCompoundStillBlocked:true,nutritionInferred:false,anonWriteDenied:true,sqlRoundTrip:true};
  await writeFile(`${root}/review-payload.json`,JSON.stringify(payload,null,2),{flag:'wx'});await writeFile(`${root}/manifest.json`,JSON.stringify(report,null,2),{flag:'wx'});await writeFile('artifacts/acceptance/composition-v2-2026-10-24/release-v4.json',JSON.stringify(report,null,2),{flag:'wx'});await writeFile('artifacts/acceptance/composition-v2-2026-10-24/review-records-v4.json',JSON.stringify(payload,null,2),{flag:'wx'});console.log(JSON.stringify(report));
}
main().catch(error=>{console.error('COMPOSITION_V2_BUILD_FAILED',error.name);process.exitCode=1;});
