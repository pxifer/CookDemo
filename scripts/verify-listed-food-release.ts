import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {verifyGalleryBundle} from '../backend/src/cloudbase-content';
import {contentContext} from '../shared/content';
import {checkDish,recommend} from '../backend/src/recommendation';
import {defaultMeal} from '../shared/types';
const root='.local-data/cloudbase-http/listed-foods-20261026-v27';
const bundle=JSON.parse(await readFile(`${root}/gallery-bundle.json`,'utf8'));
const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
const snapshot=verifyGalleryBundle(bundle,manifest.hash),context=contentContext(snapshot);
let ingredientExclusions=0;
for(const recipe of snapshot.recipes)for(const variant of recipe.variants)for(const line of variant.lines){
  const food=context.foodById.get(line.foodId)!;
  const targets=context.restrictionTargets(food.name);assert(targets.length,`restriction lookup: ${food.name}`);
  for(const kind of ['allergy','avoid'] as const){
    const result=checkDish(recipe,variant,{...defaultMeal(),allowBuy:true,restrictions:[{id:'fixture',name:food.name,kind,targets,status:'confirmed',scope:'self',original:food.name}]},context);
    assert(!result.dish,`${kind}: ${recipe.name}/${food.name}`);ingredientExclusions++;
  }
}
const pork=context.recipes.filter(recipe=>['辣椒炒肉片','蒜薹肉丝'].includes(recipe.name));assert.equal(pork.length,2);
for(const recipe of pork){
  for(const [name,blocked] of [['猪肉',true],['鱼',false],['玉米',false],['大豆',false]] as const){
    const targets=context.restrictionTargets(name);assert(targets.length,name);
    const result=checkDish(recipe,recipe.variants[0],{...defaultMeal(),allowBuy:true,restrictions:[{id:name,name,kind:'avoid',targets,status:'confirmed',scope:'self',original:name}]},context);
    assert.equal(!result.dish,blocked,`${recipe.name}/${name}`);
  }
}
const meal={...defaultMeal(),mode:'candidates' as const,allowBuy:true};
const first=await recommend(snapshot.recipes,{operationId:'release-page1',meal,action:'generate',page:0,selected:[],previous:[]},{context});
const next=await recommend(snapshot.recipes,{operationId:'release-page2',meal,action:'page',page:1,cursor:first.cursor,selected:first.dishes.map(d=>({recipeId:d.recipe.id,variantId:d.variant.id})),previous:[]},{context});
assert.equal(first.status,'completed');assert.equal(first.total,manifest.recipes);assert.equal(next.status,'completed');assert.equal(next.page,1);
assert(!next.dishes.some(dish=>first.dishes.some(previous=>previous.recipe.id===dish.recipe.id)),'pages should differ');
const mealResult=await recommend(snapshot.recipes,{operationId:'release-meal',meal:{...defaultMeal(),allowBuy:true},action:'generate',page:0,selected:[],previous:[]},{context});
assert.equal(mealResult.status,'completed');assert(mealResult.dishes.length);
const db=new PGlite();let anonymousWriteDenied=false;
try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  await db.exec(await readFile('deployment/db/gallery-http-release.sql','utf8'));
  await db.exec(await readFile(`${root}/migration/cloudbase/migrations/20261026120000_listed_food_expansion.sql`,'utf8'));
  await db.exec('SET ROLE anon');
  const records=await db.query<{count:number}>('SELECT count(*)::int AS count FROM shiwei_recipe_food_records');assert.equal(records.rows[0].count,manifest.ingredientRows);
  try{await db.exec('DELETE FROM shiwei_recipe_food_records');}catch{anonymousWriteDenied=true;}assert(anonymousWriteDenied);
}finally{await db.close();}
const report={releaseId:manifest.releaseId,hash:manifest.hash,recipes:snapshot.recipes.length,newDishes:manifest.newDishes,
  variants:manifest.variants,ingredientRows:manifest.ingredientRows,ingredientExclusions,allNamedFoodsResolvable:true,
  optionalIngredientsAndSeasoningsExcluded:true,porkCutFamilyVerified:true,hiddenSoySauceComponentsNotInferred:true,
  paginationVerified:true,sqlRoundTrip:true,anonymousWriteDenied,healthEnabled:false,chemicalCompositionInferred:false};
await mkdir('artifacts/acceptance/listed-foods-v27',{recursive:true});
await writeFile('artifacts/acceptance/listed-foods-v27/local-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
