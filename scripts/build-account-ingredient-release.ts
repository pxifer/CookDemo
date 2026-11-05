import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { verifyGalleryBundle,galleryBundleHash } from '../backend/src/cloudbase-content';
import { ingredientEvidence, INGREDIENT_EVIDENCE_VERSION } from '../shared/ingredient-evidence';
import { ingredientNames } from '../shared/candidate-food-names';
import type { GalleryBundle } from '../backend/src/cloudbase-content';

async function main(){
  const target=resolve(process.argv[2]??'.local-data/cloudbase-http/account-ingredients-20261024-v2');
  if(!target.startsWith(resolve('.local-data/cloudbase-http')+'\\'))throw Error('RELEASE_PATH_REJECTED');
  await mkdir(target,{recursive:false});
  const bundle:GalleryBundle=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261023/gallery-bundle.json','utf8'));
  const snapshot=verifyGalleryBundle(bundle,galleryBundleHash(bundle));
  const release='gallery-preview-20261023';
  const foods=snapshot.foods.map(f=>({release_id:release,food_id:f.id,name:f.name,facts:{aliases:f.aliases,form:f.form,unit:f.unit,allergens:f.allergens,components_complete:f.componentsComplete,nutrition:f.nutrition,nutrition_sources:f.nutritionSources??null}}));
  const recipes=snapshot.recipes.flatMap(r=>r.variants.map(v=>({release_id:release,recipe_id:r.id,variant_id:v.id,name:r.name,flavor:v.flavor,source_uri:r.source.uri??'',source_record_id:r.source.recordId??null,ingredients_original:v.ingredientNotes??[],steps:v.steps,review_state:r.source.reviewed?'source-checked-existing':'candidate'})));
  const lines=snapshot.recipes.flatMap(r=>r.variants.flatMap(v=>v.lines.map((l,i)=>({release_id:release,variant_id:v.id,line_number:i+1,food_id:l.foodId,role:l.role,optional:l.optional??false,amount:l.amount,unit:l.unit,basis:l.basis,form:l.form,source_text:l.sourceText??null}))));
  const proposals=ingredientEvidence(snapshot).map(p=>({release_id:release,food_id:p.foodId,knowledge_version:INGREDIENT_EVIDENCE_VERSION,candidate:p,review_state:p.reviewState}));
  const sources=bundle.rows.map((r,i)=>({release_id:release,source_number:i+1,dish_name:r.dish_key,flavor:r.flavor,source_uri:r.source_uri,raw_record:r.raw_record}));
  const entries=sources.flatMap(r=>{
    let entry=0;
    return (['main','aux','seasonings'] as const).flatMap(section=>(r.raw_record[section]??[]).map(text=>{
      const recognized=ingredientNames(text,snapshot.foods.flatMap(f=>[f.name,...f.aliases]));
      return {release_id:release,source_number:r.source_number,entry_number:++entry,source_section:section,source_text:text,recognized_names:recognized,parse_state:recognized.length?'parsed-candidate':'needs-review'};
    }));
  });
  const sqlString=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
  const seed=(table:string,rows:unknown[])=>`INSERT INTO public.${table} SELECT * FROM jsonb_populate_recordset(NULL::public.${table},${sqlString(rows)});\n`;
  const sql=await readFile('deployment/db/account-sync.sql','utf8')+'\n'+await readFile('deployment/db/ingredient-inventory.sql','utf8')+'\n'+seed('shiwei_source_recipe_records',sources)+seed('shiwei_source_ingredient_entries',entries)+seed('shiwei_ingredient_inventory',foods)+seed('shiwei_recipe_inventory',recipes)+seed('shiwei_recipe_ingredient_lines',lines)+seed('shiwei_ingredient_proposals',proposals);
  await writeFile(join(target,'20261024010000_account_ingredients.sql'),sql,{flag:'wx'});
  const report={environment:'shiwei-d2gmiun66b7dc6a4f',release,foods:foods.length,recipes:snapshot.recipes.length,variants:recipes.length,ingredientLines:lines.length,sourceRecords:sources.length,sourceEntries:entries.length,unmatchedEntries:entries.filter(e=>e.parse_state==='needs-review'),candidateEvidence:proposals.length,requiresProductLabel:proposals.filter(p=>p.review_state==='requires-product-label').map(p=>p.candidate.sourceName),allergyGateChanged:false,nutritionInferred:false};
  await writeFile(join(target,'inventory-report.json'),JSON.stringify(report,null,2),{flag:'wx'});
  await writeFile(join(target,'ingredient-evidence.json'),JSON.stringify(proposals,null,2),{flag:'wx'});
  console.log(JSON.stringify(report));
}
main().catch(()=>{console.error('ACCOUNT_INGREDIENT_PREPARE_FAILED');process.exitCode=1;});
