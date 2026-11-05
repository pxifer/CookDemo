import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {verifyGalleryBundle} from '../backend/src/cloudbase-content';
import {COMPOSITION_BASE_HASH,reviewSnapshot,reviewedDefinitions} from '../backend/src/composition-review';
import {verifiedIngredientIdentities} from '../shared/ingredient-evidence';

const commit='0e106eea348c734fe1586f781202994439cf98a5';
const inventory=JSON.parse(await readFile('artifacts/acceptance/composition-v2-2026-10-24/all-recipe-ingredient-inventory.json','utf8')) as any[];
const bundle=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261023/gallery-bundle.json','utf8'));
const snapshot=reviewSnapshot(verifyGalleryBundle(bundle,COMPOSITION_BASE_HASH));
const identities=new Map(verifiedIngredientIdentities(snapshot).map(item=>[item.foodId,item]));
const sources=new Map<string,{text:string;sha256:string;uri?:string}>();
for(const path of ['artifacts/acceptance/composition-v2-2026-10-24/github-sources.json','artifacts/acceptance/composition-source-review-2026-10-24/howtocook-pending-sources.json']){
  const records=JSON.parse(await readFile(path,'utf8')) as any[];
  for(const source of records){
    if(source.commit!==commit)throw Error(`SOURCE_COMMIT:${source.id}`);
    if(source.blobSha){const blob=createHash('sha1').update(`blob ${Buffer.byteLength(source.text)}\0${source.text}`).digest('hex');if(blob!==source.blobSha)throw Error(`SOURCE_BLOB:${source.id}`);}
    sources.set(source.id,{text:source.text,sha256:createHash('sha256').update(source.text).digest('hex'),uri:source.uri});
  }
}
for(const id of ['R380','R382']){
  const text=await readFile(`artifacts/acceptance/account-ingredients-2026-10-24/${id}-source.md`,'utf8');
  const prior=reviewedDefinitions.find(item=>item.sourceRecord===id);
  if(!prior||createHash('sha256').update(text).digest('hex')!==prior.sourceSha256)throw Error(`LOCAL_SOURCE_HASH:${id}`);
  sources.set(id,{text,sha256:prior.sourceSha256,uri:prior.sourceUri});
}
const normalize=(value:string)=>value.normalize('NFKC').replace(/\s+/g,'').replace(/[“”‘’`*_—‐-]/g,'');
const approvals:any[]=[];let considered=0,unresolved=0;
for(const definition of reviewedDefinitions){
  const source=sources.get(definition.sourceRecord);if(!source)throw Error(`SOURCE_MISSING:${definition.sourceRecord}`);
  if(source.sha256!==definition.sourceSha256||source.uri&&source.uri!==definition.sourceUri)throw Error(`SOURCE_BINDING:${definition.sourceRecord}`);
  const row=inventory.find(item=>item.recipeId===definition.recipeId&&item.variantId===definition.variantId);
  if(!row)throw Error(`INVENTORY_MISSING:${definition.sourceRecord}`);
  for(const leaf of definition.leaves){
    if(leaf.verified!==false)continue;
    considered++;
    const identity=identities.get(leaf.foodId);if(!identity)continue;
    const lines=row.ingredients.filter((line:any)=>line.foodId===leaf.foodId);
    if(!lines.length)throw Error(`LINE_MISSING:${definition.sourceRecord}:${leaf.foodId}`);
    const originalLines=lines.map((line:any)=>String(line.sourceText??'')).filter(Boolean);
    if(originalLines.length!==lines.length)continue;
    // Alternative products (especially seasoning blends) cannot inherit the
    // identity proof of only one option in the source line.
    if(originalLines.some((line:string)=>/[或]|或者|\bor\b|\//i.test(line)))continue;
    const anchored=originalLines.every((line:string)=>{
      const core=normalize(line).replace(/（[^）]*）/g,'').replace(/\([^)]*\)/g,'');
      return core.length>1&&normalize(source.text).includes(core);
    });
    if(!anchored)continue;
    approvals.push({reviewId:definition.reviewId,recipeId:definition.recipeId,variantId:definition.variantId,foodId:leaf.foodId,
      sourceRecord:definition.sourceRecord,sourceSha256:source.sha256,sourceLines:originalLines,
      identityId:identity.identityId??leaf.foodId,identityEvidence:identity.evidence,
      evidence:`固定原方 ${definition.sourceRecord} SHA-256 ${source.sha256}；原料原文“${originalLines.join('；')}”逐条可在原方中定位；身份核为单一食材“${snapshot.foods.find(food=>food.id===leaf.foodId)?.name}”。此结论仅核实该行食材身份及其固有过敏原，不证明其他配料、品牌配方或交叉接触。`});
  }
}
const unique=new Set(approvals.map(item=>`${item.recipeId}\0${item.variantId}\0${item.foodId}`));
if(unique.size!==approvals.length)throw Error('DUPLICATE_APPROVAL');
const report={version:'composition-source-line-review-v6',sourceCommit:commit,definitionsReviewed:reviewedDefinitions.length,
  unresolvedLeavesConsidered:considered,sourceAnchoredSingleIngredientApprovals:approvals.length,
  productLabelsInferred:0,unresolvedCompositesRemainBlocked:true,sourceHashAndRecipeVariantBound:true};
const document={...report,approvals};
await writeFile('datasets/recipes/curation/composition-source-line-review-v6a.json',JSON.stringify(document,null,2)+'\n',{flag:'wx'});
await writeFile('artifacts/acceptance/composition-source-review-2026-10-24/source-composition-binding-v6a.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
