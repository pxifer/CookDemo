import {readFile} from 'node:fs/promises';
import {reviewedContent} from './lib/reviewed-content';
import {curateCandidate} from './lib/candidate-curation';
import {galleryContent} from '../server/gallery-content';
import {verifyGalleryBundle} from '../server/cloudbase-content';
import {COMPOSITION_BASE_HASH,compositionFingerprint,reviewSnapshot,reviewedDefinitions} from '../server/composition-review';
async function main(){
  const bundle=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261023/gallery-bundle.json','utf8'));
  const production=reviewSnapshot(verifyGalleryBundle(bundle,COMPOSITION_BASE_HASH));
  const cards=[...(await readFile('docs/data/recipe-cards-v3.jsonl','utf8')).trim().split(/\r?\n/).map(line=>JSON.parse(line)).filter((card:any)=>card.source==='howtocook'&&card.completeness==='full_process'),...(await readFile('docs/data/recipe-candidates-supplement-v1.jsonl','utf8')).trim().split(/\r?\n/).map(line=>JSON.parse(line))];
  const base=await reviewedContent();for(const food of base.foods){food.nutritionSources={};food.aliases.sort();}for(const recipe of base.recipes)for(const variant of recipe.variants)for(const line of variant.lines)line.optional??=false;
  const fixture=reviewSnapshot(galleryContent(base,cards.map(card=>{const row=curateCandidate(card)?.record??card;return {dish_key:row.dish_key,flavor:row.flavor,source_uri:row.url,image_url:null,raw_record:row};})));
  const summary=(snapshot:any)=>{let matched=0,missingRecipe=0,missingVariant=0,fingerprintMismatch=0,sourceUriMismatch=0;const examples:any[]=[];for(const d of reviewedDefinitions){const recipe=snapshot.recipes.find((r:any)=>r.id===d.recipeId);if(!recipe){missingRecipe++;continue;}const variant=recipe.variants.find((v:any)=>v.id===d.variantId);if(!variant){missingVariant++;continue;}const hash=compositionFingerprint(recipe,variant,snapshot,d.leaves.flatMap(leaf=>leaf.equivalentIds));if(d.sourceUri&&recipe.source.uri!==d.sourceUri){sourceUriMismatch++;if(examples.length<10)examples.push({record:d.sourceRecord,name:recipe.name,variant:d.variantId,recipeUri:recipe.source.uri,definitionUri:d.sourceUri});}if(hash===d.fingerprint)matched++;else{fingerprintMismatch++;if(examples.length<6)examples.push({record:d.sourceRecord,name:recipe.name,variant:d.variantId,expected:d.fingerprint.slice(0,8),actual:hash.slice(0,8),lineCount:variant.lines.length,reviewLineCount:d.leaves.length});}}return {matched,missingRecipe,missingVariant,fingerprintMismatch,sourceUriMismatch,examples};};
  const productionR=production.recipes.find((r:any)=>r.id==='gallery-de8b31dcd19279be'),fixtureR=fixture.recipes.find((r:any)=>r.id==='gallery-de8b31dcd19279be');
  console.log(JSON.stringify({production:summary(production),testFixture:summary(fixture),r383:{productionSource:productionR.source,fixtureSource:fixtureR.source,variants:productionR.variants.map((v:any)=>({id:v.id,lines:v.lines.map((l:any)=>({foodId:l.foodId,sourceText:l.sourceText,optional:l.optional})),steps:v.steps})),fixtureVariants:fixtureR.variants.map((v:any)=>({id:v.id,lines:v.lines.map((l:any)=>({foodId:l.foodId,sourceText:l.sourceText,optional:l.optional})),steps:v.steps}))}}));
}
main().catch(error=>{console.error('SOURCE_MATCH_AUDIT_FAILED',error.name);process.exitCode=1;});
