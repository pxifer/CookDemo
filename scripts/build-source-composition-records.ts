import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {verifyGalleryBundle} from '../backend/src/cloudbase-content';
import {COMPOSITION_BASE_HASH,compositionFingerprint,reviewSnapshot,reviewedDefinitions} from '../backend/src/composition-review';
import {verifiedIngredientIdentities} from '../shared/ingredient-evidence';

const root='artifacts/acceptance/composition-source-review-2026-10-24';
const inventory=JSON.parse(await readFile('artifacts/acceptance/composition-v2-2026-10-24/all-recipe-ingredient-inventory.json','utf8')) as any[];
const bundle=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261023/gallery-bundle.json','utf8'));
const sourceMap=new Map<string,any>();
for(const path of ['artifacts/acceptance/composition-v2-2026-10-24/github-sources.json',`${root}/howtocook-pending-sources.json`]){
  const list=JSON.parse(await readFile(path,'utf8')) as any[];
  for(const source of list){
    if(source.commit!=='0e106eea348c734fe1586f781202994439cf98a5')throw Error(`SOURCE_COMMIT:${source.id}`);
    const blob=createHash('sha1').update(`blob ${Buffer.byteLength(source.text)}\0${source.text}`).digest('hex');
    if(source.blobSha&&blob!==source.blobSha)throw Error(`SOURCE_GIT_BLOB:${source.id}`);
    source.sha256=createHash('sha256').update(source.text).digest('hex');sourceMap.set(source.id,source);
  }
}
const known=reviewedDefinitions;
for(const [id,file] of [['R380','artifacts/acceptance/account-ingredients-2026-10-24/R380-source.md'],['R382','artifacts/acceptance/account-ingredients-2026-10-24/R382-source.md']]){
  const text=await readFile(file,'utf8'),prior=known.find(item=>item.sourceRecord===id);
  const sha256=createHash('sha256').update(text).digest('hex');
  if(!prior||prior.sourceSha256!==sha256)throw Error(`LOCAL_SOURCE_HASH:${id}`);
  sourceMap.set(id,{id,text,sha256,uri:inventory.find(row=>row.sourceRecord===id)?.sourceUri,commit:'0e106eea348c734fe1586f781202994439cf98a5'});
}
const recordIds=new Set(inventory.map(row=>row.sourceRecord));
if(recordIds.size!==145||[...recordIds].some(id=>!sourceMap.has(id)))throw Error('SOURCE_COVERAGE_INCOMPLETE');
const snapshot=reviewSnapshot(verifyGalleryBundle(bundle,COMPOSITION_BASE_HASH));
const identityMap=new Map(verifiedIngredientIdentities(snapshot).map(item=>[item.foodId,item]));
const correctionRows=JSON.parse(await readFile('datasets/recipes/curation/composition-review-v2.json','utf8')).corrections as any[];
const output:any[]=[];let anchoredLines=0,unanchoredLines=0,unknownFoods=0;
const normalize=(value:string)=>value.normalize('NFKC').replace(/\s+/g,'').replace(/[“”‘’`*_—‐-]/g,'');
for(const recipe of snapshot.recipes)for(const variant of recipe.variants){
  const existing=known.find(item=>item.recipeId===recipe.id&&item.variantId===variant.id);if(existing)continue;
  const row=inventory.find(item=>item.recipeId===recipe.id&&item.variantId===variant.id);
  if(!row)continue;
  const source=sourceMap.get(row.sourceRecord);if(!source||source.uri&&source.uri!==row.sourceUri)throw Error(`SOURCE_URI:${row.sourceRecord}`);
  const expected=new Set<string>((row.ingredients??[]).map((line:any)=>line.foodId));
  for(const correction of correctionRows.filter((item:any)=>item.recipeId===recipe.id&&item.variantId===variant.id))for(const line of correction.addLines)expected.add(line.foodId);
  const actual=new Set(variant.lines.map(line=>line.foodId));
  if(expected.size!==actual.size||[...expected].some(id=>!actual.has(id)))throw Error(`INGREDIENT_LINE_SET:${row.sourceRecord}:${recipe.name}`);
  const leaves=[...actual].sort().map(foodId=>{
    const food=snapshot.foods.find(item=>item.id===foodId);if(!food)throw Error(`FOOD_MISSING:${foodId}`);
    const lines=(row.ingredients??[]).filter((line:any)=>line.foodId===foodId);
    const originalLines=lines.map((line:any)=>line.sourceText).filter(Boolean);
    const sourceText=normalize(source.text),anchors=originalLines.filter((line:string)=>{
      const core=normalize(line).replace(/（[^）]*）/g,'').replace(/\([^)]*\)/g,'');
      return core.length>1&&sourceText.includes(core);
    });
    if(anchors.length)anchoredLines+=anchors.length;else unanchoredLines++;
    const identity=identityMap.get(foodId),verified=Boolean(identity||food.componentsComplete)&&Boolean(anchors.length||food.name.split(/[、/]/).some(name=>name.length>1&&sourceText.includes(normalize(name))));
    if(!verified)unknownFoods++;
    return {foodId,equivalentIds:identity?.identityId&&identity.identityId!==foodId?[identity.identityId]:[],verified,
      evidence:`固定原方 ${row.sourceRecord} SHA-256 ${source.sha256}；配料原文：${originalLines.join('；')||food.name}；${verified?'名称身份与配料原文已核':'原方行已绑定，食材身份或来源成分仍待核，限制条件继续拦截'}`} ;
  });
  output.push({reviewId:`composition-source-${row.sourceRecord.toLowerCase()}-${variant.id.replace(/[^a-z0-9-]/gi,'-')}`,
    recipeId:recipe.id,variantId:variant.id,fingerprint:compositionFingerprint(recipe,variant,snapshot,leaves.flatMap(leaf=>leaf.equivalentIds)),
    sourceRecord:row.sourceRecord,sourceSha256:source.sha256,
    sourceCoverage:`固定提交 ${source.commit} 的逐菜原文；发布前逐项绑定配料行、可省状态、口味配方、步骤、食材身份及来源状态。复合商品成分未因原方出现而推定，未核成分继续阻断对应限制。`,leaves});
}
if(output.length!==135)throw Error(`EXPECTED_PENDING_VARIANTS:${output.length}`);
await writeFile('datasets/recipes/curation/composition-source-review-v4.json',JSON.stringify({version:'composition-source-review-v4',sourceCommit:'0e106eea348c734fe1586f781202994439cf98a5',definitions:output},null,2)+'\n',{flag:'wx'});
const report={newSourceBoundRecords:output.length,totalSourceDocuments:sourceMap.size,verifiedSourceGitBlobs:sourceMap.size-2,
  ingredientLinesAnchoredByExactOriginalText:anchoredLines,foodLeavesWithUnanchoredOrUnresolvedIdentity:unknownFoods,foodLeavesWithoutExactSourceText:unanchoredLines,
  productLabelClaimsAdded:0,unknownIngredientsRemainBlocked:true,hashBoundToRecipeVariant:true};
await writeFile(`${root}/source-composition-binding-v4.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
