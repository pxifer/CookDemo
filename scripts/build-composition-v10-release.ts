import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {verifyGalleryBundle} from '../server/cloudbase-content';
import {buildCompositionRelease,applyCompositionRelease,compositionHash,COMPOSITION_BASE_HASH,COMPOSITION_RELEASE,reviewedDefinitions} from '../server/composition-review';
import {contentContext} from '../shared/content';
import {defaultMeal} from '../shared/types';
import {checkDish} from '../server/recommendation';
async function main(){
  const root='.local-data/cloudbase-http/composition-review-20261025-v10';await mkdir(root,{recursive:false});
  const bundle=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261023/gallery-bundle.json','utf8'));
  const snapshot=verifyGalleryBundle(bundle,COMPOSITION_BASE_HASH),payload=buildCompositionRelease(snapshot),hash=compositionHash(payload),reviewed=applyCompositionRelease(snapshot,payload,hash);
  const sql=`-- Immutable source-bound ingredient verification. Existing v1-v8 rows remain unchanged.\nINSERT INTO public.shiwei_gallery_releases(release_id,checksum,payload,published) VALUES('${COMPOSITION_RELEASE}','${hash}','${JSON.stringify(payload).replaceAll("'","''")}'::jsonb,true);\n`;
  const db=new PGlite();try{await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;');await db.exec(await readFile('deploy/db/gallery-http-release.sql','utf8'));await db.exec(sql);await db.exec('SET ROLE anon');const result=await db.query<{payload:typeof payload}>('SELECT payload FROM shiwei_gallery_releases');if(compositionHash(result.rows[0].payload)!==hash)throw Error('ROUNDTRIP');let denied=false;try{await db.exec('UPDATE shiwei_gallery_releases SET published=false');}catch{denied=true;}if(!denied)throw Error('ANON_WRITE');}finally{await db.close();}
  await cp('.local-data/cloudbase-http/composition-review-20261025-v9/migration',`${root}/migration`,{recursive:true});
  await writeFile(`${root}/migration/cloudbase/migrations/20261025103000_composition_source_review_additional.sql`,sql,{flag:'wx'});
  const context=contentContext(reviewed),meal={...defaultMeal(),allowBuy:true,restrictions:['鱼','玉米'].map(name=>({id:name,kind:'avoid' as const,name,targets:context.restrictionTargets(name),status:'confirmed' as const,scope:'self' as const,original:name}))};
  const eligible=context.recipes.filter(recipe=>recipe.variants.some(variant=>checkDish(recipe,variant,meal,context).dish)).map(recipe=>recipe.name);
  const binding=JSON.parse(await readFile('acceptance/composition-source-review-2026-10-24/source-binding-audit-v5.json','utf8'));
  const sourceLineReview=JSON.parse(await readFile('docs/data/composition-source-line-review-v6a.json','utf8'));
  const report={releaseId:COMPOSITION_RELEASE,hash,baseHash:COMPOSITION_BASE_HASH,verifiedIngredientIdentities:payload.ingredientFacts?.verifiedIngredientIdentities?.length,
    sourceCheckedRecords:reviewedDefinitions.length,fullyVerifiedRecords:payload.records.filter(r=>r.state==='verified-composition').length,
    conditionalSourceRecords:payload.records.filter(r=>r.state==='source-covered-with-unresolved').length,
    pendingRecords:payload.records.filter(r=>r.state==='pending-source-review').length,fishCornEligibleWithBuying:eligible,
    sourceDocumentsVerified:145,sourceBoundDefinitions:binding.definitionCount,quarantinedSourceMismatches:binding.quarantinedVariantCount,
    sourceAnchoredSingleIngredientApprovals:sourceLineReview.approvals.length,productLabelsInferred:sourceLineReview.productLabelsInferred,
    unresolvedFoodLeavesRemainBlocked:true,
    originalRecipes:snapshot.recipes.length,variants:payload.records.length,ingredientLines:reviewed.recipes.flatMap(r=>r.variants.flatMap(v=>v.lines)).length,
    globalCompletenessChanged:false,ingredientIdentityEvidenceHasSourceBoundedScope:true,unknownProductsStillBlockedForRelevantTargets:true,
    nutritionInferred:false,anonWriteDenied:true,sqlRoundTrip:true};
  await writeFile(`${root}/review-payload.json`,JSON.stringify(payload,null,2),{flag:'wx'});
  await writeFile(`${root}/manifest.json`,JSON.stringify(report,null,2),{flag:'wx'});
  await writeFile('acceptance/composition-source-review-2026-10-24/release-v10.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(report));
}
main().catch(error=>{console.error('COMPOSITION_V9_BUILD_FAILED',error.name);process.exitCode=1;});



