import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyGalleryBundle} from '../server/cloudbase-content';
import {galleryContent} from '../server/gallery-content';
import {COMPOSITION_BASE_HASH} from '../server/composition-review';
import {ingredientEvidence,verifiedIngredientIdentities} from '../shared/ingredient-evidence';

const bundle=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261023/gallery-bundle.json','utf8'));
const snapshot=galleryContent(verifyGalleryBundle(bundle,COMPOSITION_BASE_HASH),bundle.rows);
const inventory=JSON.parse(await readFile('acceptance/composition-v2-2026-10-24/all-recipe-ingredient-inventory.json','utf8')) as any[];
const sourcePack=JSON.parse(await readFile('acceptance/composition-source-review-2026-10-24/howtocook-pending-sources.json','utf8')) as any[];
const sources=new Map(sourcePack.map(source=>[source.id,source]));
for(const source of sourcePack){
  if(source.commit!=='0e106eea348c734fe1586f781202994439cf98a5')throw Error('SOURCE_COMMIT');
  const gitBlob=createHash('sha1').update(`blob ${Buffer.byteLength(source.text)}\0${source.text}`).digest('hex');
  if(gitBlob!==source.blobSha)throw Error(`SOURCE_BLOB:${source.id}`);
}
const extraSourceFiles=['acceptance/composition-v2-2026-10-24','acceptance/account-ingredients-2026-10-24'];
for(const id of new Set(inventory.map(recipe=>recipe.sourceRecord)))if(!sources.has(id)){
  for(const folder of extraSourceFiles){try{const text=await readFile(`${folder}/${id}-source.md`,'utf8');sources.set(id,{id,text,commit:'0e106eea348c734fe1586f781202994439cf98a5',uri:inventory.find(recipe=>recipe.sourceRecord===id)?.sourceUri,localPath:`${folder}/${id}-source.md`});break;}catch{}}
}
const priorReview=JSON.parse(await readFile('acceptance/composition-v2-2026-10-24/review-records-v4.json','utf8'));
for(const record of priorReview.records.filter((item:any)=>item.approval)){
  const expected=record.evidence.sourceSha256,entry=sources.get(record.evidence.sourceRecord);
  if(entry?.localPath&&createHash('sha256').update(entry.text).digest('hex')!==expected)throw Error(`SOURCE_SHA256:${record.evidence.sourceRecord}`);
}
if(sources.size!==new Set(inventory.map(recipe=>recipe.sourceRecord)).size)throw Error('SOURCE_COVERAGE_GAP');
const evidence=new Map(ingredientEvidence(snapshot).map(item=>[item.foodId,item]));
const identities=new Map(verifiedIngredientIdentities(snapshot).map(item=>[item.foodId,item]));
const uses=new Map<string,any[]>();
for(const recipe of inventory)for(const line of recipe.ingredients)uses.set(line.foodId,[...(uses.get(line.foodId)??[]),{recipeId:recipe.recipeId,variantId:recipe.variantId,recipe:recipe.name,sourceRecord:recipe.sourceRecord,name:line.name,sourceText:line.sourceText,optional:line.optional,role:line.role}]);
const foods=snapshot.foods.map(food=>{
  const candidate=evidence.get(food.id),identity=identities.get(food.id);
  const rows=uses.get(food.id)??[];
  const verifiedFishCorn=identity&&(identity.identityId==='fish'||identity.identityId===snapshot.foods.find(item=>item.name==='玉米')?.id||identity.allergens.includes('fish'));
  const state=identity?'verified-whole-food-name':candidate?.reviewState==='requires-product-label'?'product-label-required':food.componentsComplete?'catalog-fact-present':'unresolved-source-or-composition';
  return {foodId:food.id,name:food.name,aliases:food.aliases,allergens:food.allergens,componentsComplete:food.componentsComplete,
    verificationState:state,identity:identity??null,fishOrCornFact:verifiedFishCorn?'verified':null,
    candidateEvidence:candidate??null,usageCount:rows.length,uses:rows};
});
const variants=inventory.map(recipe=>{
  const source=sources.get(recipe.sourceRecord);
  return {recipeId:recipe.recipeId,variantId:recipe.variantId,recipe:recipe.name,sourceRecord:recipe.sourceRecord,
    sourceUri:recipe.sourceUri,sourceCommit:source?.commit??'0e106eea348c734fe1586f781202994439cf98a5',
    sourceBlobSha1:source?.blobSha??null,sourceSha256:source?createHash('sha256').update(source.text).digest('hex'):null,
    sourceFile:source?.localPath??`acceptance/composition-source-review-2026-10-24/howtocook-pending-sources.json#${recipe.sourceRecord}`,
    ingredients:recipe.ingredients.map((line:any)=>({foodId:line.foodId,name:line.name,sourceText:line.sourceText,
      optional:line.optional,role:line.role,ingredientVerification:identities.has(line.foodId)?'verified-name-and-intrinsic-allergen':
        evidence.get(line.foodId)?.reviewState==='requires-product-label'?'product-label-required':'source-or-composition-unresolved'})),
    compositionReview:recipe.sourceReview};
});
const report={version:'ingredient-verification-audit-20261024-v1',baseRelease:bundle.base.contentVersion,checkedAt:'2026-10-24',
  sourceCommit:'0e106eea348c734fe1586f781202994439cf98a5',foodCount:foods.length,recipeVariantCount:variants.length,
  sourceFilesCovered:sources.size,foodStates:Object.fromEntries([...new Set(foods.map(food=>food.verificationState))].map(state=>[state,foods.filter(food=>food.verificationState===state).length])),
  recipeCompositionStates:Object.fromEntries([...new Set(variants.map(item=>item.compositionReview))].map(state=>[state,variants.filter(item=>item.compositionReview===state).length])),
  policy:'每个食材和配方变体均列明来源及状态。确认的整食材名称只用于其内在身份/过敏原；复合商品标签不明保持拦截；食材名匹配不被当成成分证明。',foods,variants};
await writeFile('acceptance/composition-source-review-2026-10-24/ingredient-verification-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({foodCount:report.foodCount,recipeVariantCount:report.recipeVariantCount,sourceFilesCovered:report.sourceFilesCovered,foodStates:report.foodStates,recipeCompositionStates:report.recipeCompositionStates}));
