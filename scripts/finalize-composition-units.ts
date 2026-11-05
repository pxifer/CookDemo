import {readFile,writeFile} from 'node:fs/promises';
import data from '../datasets/recipes/curation/composition-review-v2.json';
import {verifyGalleryBundle} from '../backend/src/cloudbase-content';
import {COMPOSITION_BASE_HASH,reviewSnapshot,compositionFingerprint} from '../backend/src/composition-review';

const bundle=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261023/gallery-bundle.json','utf8'));
const original=verifyGalleryBundle(bundle,COMPOSITION_BASE_HASH);
for(const correction of data.corrections)for(const line of correction.addLines){
  const food=original.foods.find(food=>food.id===line.foodId);
  if(!food||line.amount!==null)throw Error('UNIT_CORRECTION_SCOPE');
  line.unit=food.unit;
}
if(!data.unresolvedComponents.some(record=>record.foodId==='oil'))data.unresolvedComponents.push({foodId:'oil',evidence:'原方仅写食用油，未明确植物来源，可能含玉米油、花生油、大豆油或调和油。市场监管总局食用植物油生产许可审查细则及预包装油标签说明；不能据通用油名证明不含限制成分。'});
const oilNote=' 食用油来源未定，不据此核验记录放行。';
for(const definition of data.definitions)for(const leaf of definition.leaves)if(leaf.foodId==='oil')Object.assign(leaf,{verified:false,evidence:leaf.evidence.endsWith(oilNote)?leaf.evidence:leaf.evidence+oilNote});
// Every persisted row is immutable; correction is a new release.
const reviewed=reviewSnapshot(original);
for(const definition of data.definitions){
  const recipe=reviewed.recipes.find(recipe=>recipe.id===definition.recipeId)!;
  const variant=recipe.variants.find(variant=>variant.id===definition.variantId)!;
  definition.fingerprint=compositionFingerprint(recipe,variant,reviewed,definition.leaves.flatMap(leaf=>leaf.equivalentIds));
}
await writeFile('datasets/recipes/curation/composition-review-v2.json',JSON.stringify(data,null,2));
console.log(JSON.stringify({unitsCorrected:true,genericOilRemainsUnresolved:true,newImmutableRelease:'composition-review-20261024-v4',amountsInferred:false}));
