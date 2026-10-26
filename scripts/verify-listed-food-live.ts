import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {contentContext,type ContentSnapshot} from '../shared/content';
import {matchesListedFood} from '../shared/food-restrictions';
import {defaultMeal,type Meal,type RecommendationResult} from '../shared/types';
import {CloudBaseGalleryRepository} from '../server/cloudbase-content';
import {GALLERY_RELEASE} from '../server/gallery-content';
const packageRoot='.local-data/cloudbase-http/release-20261026-listed-foods-v27';
const config=JSON.parse(await readFile(`${packageRoot}/cloudbaserc.json`,'utf8'));
const env=config.functions[0].envVariables,origin=env.APP_ORIGIN;
const manifest=JSON.parse(await readFile(`${packageRoot}/content-manifest.json`,'utf8'));
const repository=new CloudBaseGalleryRepository({envId:env.CLOUDBASE_ENV_ID,publishableKey:env.CLOUDBASE_PUBLISHABLE_KEY,releaseId:env.CONTENT_BUNDLE_ID,hash:env.CONTENT_BUNDLE_SHA256});
const databaseSnapshot=await repository.load(GALLERY_RELEASE);assert.equal(databaseSnapshot.recipes.length,manifest.recipes);
const counts:Record<string,number>={};
for(const table of ['shiwei_food_identity_records','shiwei_recipe_food_records']){
  const response=await fetch(`https://${env.CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest/${table}?release_id=eq.${manifest.releaseId}&select=food_id&limit=1`,{
    headers:{Authorization:`Bearer ${env.CLOUDBASE_PUBLISHABLE_KEY}`,Prefer:'count=exact'},signal:AbortSignal.timeout(15000)});
  assert(response.ok,`${table} HTTP ${response.status}`);
  counts[table]=Number(response.headers.get('content-range')?.split('/')[1]);
}
assert.equal(counts.shiwei_recipe_food_records,manifest.ingredientRows);assert.equal(counts.shiwei_food_identity_records,manifest.foods);
const catalogResponse=await fetch(`${origin}/api/v1/catalog/recipes`,{signal:AbortSignal.timeout(20000)});assert(catalogResponse.ok,`catalog ${catalogResponse.status}`);
const catalog=await catalogResponse.json() as ContentSnapshot;assert.equal(catalog.contentVersion,manifest.releaseId);assert.equal(catalog.restrictionScope,'listed-foods');assert.equal(catalog.recipes.length,manifest.recipes);
const context=contentContext(catalog);
const sessionResponse=await fetch(`${origin}/api/v1/auth/session`,{signal:AbortSignal.timeout(15000)});
assert(sessionResponse.ok);const session=await sessionResponse.json() as {csrfToken:string};
const cookie=sessionResponse.headers.get('set-cookie')?.split(';',1)[0];assert(cookie&&session.csrfToken);
let requestCount=0;const latencies:number[]=[];
async function request(meal:Meal,extra:Record<string,unknown>={}):Promise<RecommendationResult>{
  const started=performance.now();requestCount++;
  const response=await fetch(`${origin}/api/v1/recommendations`,{method:'POST',headers:{Origin:origin,Cookie:cookie!,'Content-Type':'application/json','x-csrf-token':session.csrfToken},
    body:JSON.stringify({operationId:`v27-live-${Date.now()}-${requestCount}`,contentVersion:catalog.contentVersion,meal,action:'generate',page:0,selected:[],previous:[],...extra}),signal:AbortSignal.timeout(30000)});
  assert(response.ok,`recommendation ${response.status}`);const result=await response.json() as RecommendationResult;
  assert.equal(result.status,'completed');assert(result.dishes.length);latencies.push(Math.round(performance.now()-started));return result;
}
const cases=[];
for(const name of ['猪肉','鱼','玉米','大蒜','生抽','青椒'])for(const kind of ['allergy','avoid'] as const){
  const targets=context.restrictionTargets(name);assert(targets.length,name);
  const meal={...defaultMeal(),mode:'candidates' as const,allowBuy:true,checkSeasonings:false,restrictions:[{id:name,name,kind,targets,status:'confirmed' as const,scope:'self' as const,original:name}]};
  const result=await request(meal);
  const targetFoods=targets.map(id=>context.foodById.get(id)!);
  assert(result.dishes.every(dish=>dish.variant.lines.every(line=>!matchesListedFood(context.foodById.get(line.foodId)!,targetFoods))),`${kind}/${name}`);
  cases.push({name,kind,returned:result.dishes.map(dish=>dish.recipe.name),excluded:true});
}
const candidateMeal={...defaultMeal(),mode:'candidates' as const,allowBuy:true};
const first=await request(candidateMeal);
const second=await request(candidateMeal,{action:'page',page:1,cursor:first.cursor,selected:first.dishes.map(dish=>({recipeId:dish.recipe.id,variantId:dish.variant.id}))});
assert.equal(second.page,1);assert(!second.dishes.some(dish=>first.dishes.some(old=>old.recipe.id===dish.recipe.id)));
const meal={...defaultMeal(),allowBuy:true};const selected=await request(meal);
const replacement=await request(meal,{action:'replace',replaceId:selected.dishes[0].recipe.id,selected:selected.dishes.map(dish=>({recipeId:dish.recipe.id,variantId:dish.variant.id})),previous:selected.dishes.map(dish=>dish.recipe.id)});
assert.notEqual(replacement.dishes[0].recipe.id,selected.dishes[0].recipe.id);
assert.deepEqual(replacement.dishes.slice(1).map(d=>d.recipe.id),selected.dishes.slice(1).map(d=>d.recipe.id));
const html=await fetch(origin,{signal:AbortSignal.timeout(15000)});assert(html.ok);const text=await html.text();assert(text.includes('/assets/index-'));
const report={liveHttp:true,releaseId:manifest.releaseId,hash:manifest.hash,recipes:catalog.recipes.length,newDishes:manifest.newDishes,
  databaseCounts:counts,databaseBundleReadbackVerified:true,restrictionScope:catalog.restrictionScope,cases,paginationVerified:true,
  replacePreservesOtherDishes:true,latenciesMs:latencies,healthEnabled:false,secretsPrinted:false};
await writeFile('acceptance/listed-foods-v27/live-verification.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
