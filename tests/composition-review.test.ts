import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { reviewedContent } from '../scripts/lib/reviewed-content';
import { curateCandidate } from '../scripts/lib/candidate-curation';
import { galleryContent, GALLERY_RELEASE } from '../server/gallery-content';
import { CloudBaseGalleryRepository, galleryBundleHash, type GalleryBundle } from '../server/cloudbase-content';
import { applyCompositionRelease, buildCompositionRelease, compositionHash, reviewedDefinitions } from '../server/composition-review';
import { contentContext } from '../shared/content';
import { defaultMeal, type Meal, type RecommendationRequest } from '../shared/types';
import { checkDish, recommend } from '../server/recommendation';
import { createApp } from '../server/app';

async function fixture() {
  const read = async (path: string) => (await readFile(path,'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line));
  const cards = [...(await read('docs/data/recipe-cards-v3.jsonl')).filter(card => card.source==='howtocook'&&card.completeness==='full_process'), ...await read('docs/data/recipe-candidates-supplement-v1.jsonl')];
  const bundle: GalleryBundle = {base:await reviewedContent(),rows:cards.map(card=>{const r=curateCandidate(card)?.record??card;return {dish_key:r.dish_key,flavor:r.flavor,source_uri:r.url,image_url:null,raw_record:r};})};
  bundle.rows.sort((a,b)=>Number(b.raw_record.id==='R383')-Number(a.raw_record.id==='R383'));
  // The published PG export represents missing nutrition source rows as {}.
  // Reproduce that fixed release representation; production hashes stay strict.
  for(const food of bundle.base.foods){food.nutritionSources={};food.aliases.sort();}
  for(const recipe of bundle.base.recipes)for(const variant of recipe.variants)for(const line of variant.lines)line.optional??=false;
  const snapshot = galleryContent(bundle.base,bundle.rows);
  const review=buildCompositionRelease(snapshot);
  const approved = applyCompositionRelease(snapshot,review,compositionHash(review));
  return { bundle,snapshot,review,approved,context:contentContext(approved) };
}
function restricted(name: string, targets: string[], kind: 'avoid'|'allergy'='allergy'): Meal {
  return {...defaultMeal(),allowBuy:true,mode:'candidates',restrictions:[{id:'test-only',kind,name,targets,status:'confirmed',scope:'self',original:`构造${name}限制`}]};
}
function available(names:string[],context:ReturnType<typeof contentContext>):Meal['ingredients']{return names.map((name,index)=>({id:`test-${index}`,foodId:context.findFood(name)!.id,name,amount:'',basis:'unknown',form:'raw',status:'confirmed',original:name}));}

test('鱼和玉米：过敏及忌口均可返回已核实菜谱，现有库存不强迫使用被限制食材',async()=>{
  const {context}=await fixture();
  for(const kind of ['allergy','avoid'] as const){
    const meal={...defaultMeal(),checkSeasonings:false,ingredients:available(['牛肉','鱼','玉米','白菜','鸡蛋','西红柿','金针菇'],context),restrictions:['鱼','玉米'].map(name=>({id:name,kind,name,targets:context.restrictionTargets(name),status:'confirmed' as const,scope:'self' as const,original:name}))};
    const result=await recommend(context.recipes,{operationId:`fish-corn-${kind}`,meal,action:'generate',page:0,selected:[],previous:[]},{context});
    assert.equal(result.status,'completed',JSON.stringify({status:result.status,reasons:result.reasons}));assert.ok(result.dishes.length>0);
    for(const dish of result.dishes)for(const check of dish.checks)assert.ok(!context.components(check.foodId).some(food=>['鱼','玉米'].includes(food.name)));
  }
});

test('确认含鱼/玉米的加工配料必须排除；淀粉来源不明仍拦截，不把单配料名当阴性证明',async()=>{
  const {context}=await fixture();
  for(const [recipeName,target,ingredient] of [['松仁玉米','玉米','玉米粒'],['炸洋葱花','玉米','玉米淀粉'],['醉排骨','鱼','鱼露']] as const){
    const recipe=context.recipes.find(r=>r.name===recipeName)!,result=checkDish(recipe,recipe.variants[0],restricted(target,context.restrictionTargets(target)),context);
    assert.equal(result.dish,undefined);assert.ok(result.reasons.some(reason=>reason.includes(ingredient)&&reason.includes('含有需避开')));
  }
  assert.ok(context.unresolvedComponents?.includes('starch'));
  assert.ok(context.unresolvedComponents?.includes('oil'));
  const genericOil=context.recipes.find(r=>r.name==='番茄蛋花汤')!;
  assert.equal(checkDish(genericOil,genericOil.variants[0],restricted('玉米',context.restrictionTargets('玉米')),context).dish,undefined,'generic edible oil cannot prove corn absence');
  const ambiguous=context.recipes.find(r=>r.name==='拔丝土豆')!;assert.equal(checkDish(ambiguous,ambiguous.variants[0],restricted('玉米',context.restrictionTargets('玉米')),context).dish,undefined);
  const ribs=context.recipes.find(r=>r.name==='排骨苦瓜汤')!;assert.ok(checkDish(ribs,ribs.variants[0],restricted('玉米',context.restrictionTargets('玉米')),context).dish,'an unverified animal identity does not imply corn conflict');
});
test('来源未知只阻断相关限制：通用油和淀粉不能导致鱼限制下整类菜谱误拦',async()=>{
  const {context}=await fixture();
  for(const [recipeName,foodName] of [['番茄蛋花汤','食用油'],['拔丝土豆','淀粉']] as const){
    const original=context.recipes.find(r=>r.name===recipeName)!;
    const recipe={...original,source:{...original.source,kind:'community' as const}};
    const fish=checkDish(recipe,recipe.variants[0],{...restricted('鱼',context.restrictionTargets('鱼')),allowBuy:true},context);
    assert.ok(fish.dish,`${foodName}来源不明与鱼无关，不应阻断: ${fish.reasons.join(';')}`);
    const corn=checkDish(recipe,recipe.variants[0],{...restricted('玉米',context.restrictionTargets('玉米')),allowBuy:true},context);
    assert.equal(corn.dish,undefined,`${foodName}来源不明时应继续阻断玉米限制`);
  }
});
test('逐项身份关联命中食物本身的过敏原，别名不再被不相关的成分未核拦截',async()=>{
  const {context}=await fixture();
  const sesame=context.findFood('芝麻')!;
  assert.ok(context.verifiedIngredientIdentities?.some(item=>item.foodId===sesame.id&&item.allergens.includes('sesame')));
  const recipe=context.recipes.find(r=>r.name==='拔丝土豆')!;
  const fish=checkDish({...recipe,source:{...recipe.source,kind:'community'}},recipe.variants[0],restricted('鱼',context.restrictionTargets('鱼')),context);
  assert.ok(fish.dish,'芝麻、油和淀粉不能仅因食材关联关系不完整就挡住鱼限制');
  const sesameAllergy=checkDish(recipe,recipe.variants[0],restricted('芝麻',context.restrictionTargets('芝麻'),'allergy'),context);
  assert.equal(sesameAllergy.dish,undefined);
  assert.ok(sesameAllergy.reasons.some(reason=>reason.includes('含有需避开')));
});
test('所有菜谱中的鱼/玉米来源名均有正向成分关系，商品名不因关键词误判',async()=>{
  const {context}=await fixture();
  const fishNames=['鳝丝','鳝鱼','昂刺鱼','沙光鱼','桂鱼','鳜鱼','草鱼','鲤鱼','鱼头','剑骨鱼','翘嘴鱼','鳊鱼','鱼露','鱼丸'];
  for(const name of fishNames){const food=context.foods.find(item=>item.name===name);assert.ok(food,`catalogue ${name}`);assert.ok(context.components(food.id).some(item=>item.id==='fish'),`${name} -> fish`);}
  for(const name of ['玉米粒','玉米淀粉']){const food=context.foods.find(item=>item.name===name);assert.ok(food,`catalogue ${name}`);assert.ok(context.components(food.id).some(item=>item.name==='玉米'),`${name} -> corn`);}
  const soySauce=context.foods.find(item=>item.name==='蒸鱼豉油')!;
  assert.equal(context.components(soySauce.id).some(item=>item.id==='fish'),false,'菜名/产品名中的鱼字不作为含鱼证据');
  assert.equal(context.verifiedIngredientIdentities?.some(item=>item.foodId===context.foods.find(food=>food.name==='排骨')?.id),false,'动物种类不明的排骨不猜作猪肉');
  assert.ok(context.unresolvedComponents?.includes('starch')&&context.unresolvedComponents?.includes('oil'));
});
test('逐方证据：145份通过逐项来源核对，错绑的清蒸鳜鱼版本保留待核；不改全局食物完备性和营养',async()=>{
  const {snapshot,review,approved}=await fixture();
  assert.equal(review.records.length,146);assert.equal(review.records.filter(r=>r.approval).length,145);assert.equal(review.records.filter(r=>r.state==='pending-source-review').length,1);
  assert.equal(reviewedDefinitions.length,145);
  assert.equal(approved.compositionApprovals?.length,reviewedDefinitions.length);assert.deepEqual(approved.foods,snapshot.foods);
  for(const definition of reviewedDefinitions){
    const original=definition.reviewId.startsWith('composition-source-')
      ? (JSON.parse(await readFile('acceptance/composition-v2-2026-10-24/github-sources.json','utf8')) as any[]).concat(JSON.parse(await readFile('acceptance/composition-source-review-2026-10-24/howtocook-pending-sources.json','utf8')) as any[]).find(source=>source.id===definition.sourceRecord)?.text
      : await readFile(`acceptance/${definition.reviewId.endsWith('v2')?'composition-v2-2026-10-24':'account-ingredients-2026-10-24'}/${definition.sourceRecord}-source.md`);
    assert.ok(original,`missing fixed source ${definition.sourceRecord}`);
    assert.equal(createHash('sha256').update(original).digest('hex'),definition.sourceSha256);
  }
  assert.equal(snapshot.foods.find(f=>f.name==='南瓜')?.componentsComplete,false);
  for(const correction of (review.ingredientFacts as {corrections:{addLines:{foodId:string;amount:null;unit:string}[]}[]}).corrections)
    for(const line of correction.addLines){assert.equal(line.amount,null);assert.equal(line.unit,snapshot.foods.find(food=>food.id===line.foodId)!.unit);}
});
test('新增成分核验只放行原方可定位的单一食材，复合商品和替代配料仍保持未核',async()=>{
  const {context}=await fixture();
  const review=JSON.parse(await readFile('docs/data/composition-source-line-review-v6a.json','utf8')) as {approvals:any[];productLabelsInferred:number};
  assert.equal(review.approvals.length,75);assert.equal(review.productLabelsInferred,0);
  for(const approval of review.approvals){
    const definition=reviewedDefinitions.find(item=>item.recipeId===approval.recipeId&&item.variantId===approval.variantId)!;
    const leaf=definition.leaves.find(item=>item.foodId===approval.foodId);
    assert.equal(leaf?.verified,true,`${approval.sourceRecord}:${context.foodById.get(approval.foodId)?.name}`);
    assert.equal(definition.sourceSha256,approval.sourceSha256);
    assert.ok(approval.sourceLines.length>0&&approval.evidence.includes(approval.sourceLines[0]));
  }
  for(const name of ['午餐肉','蚝油','生抽','食用油','水淀粉','印度综合香料粉']){
    const food=context.findFood(name)!;
    assert.ok(reviewedDefinitions.some(definition=>definition.leaves.some(leaf=>leaf.foodId===food.id&&leaf.verified===false)),`${name} remains unverified`);
    assert.equal(review.approvals.some(approval=>approval.foodId===food.id),false,`${name} never inherits a single-food identity proof`);
  }
});
test('逐项比对菜谱明列食材：已核验或未核验均拦截直接冲突，不因无关未核项误拦整菜',async()=>{
  const {snapshot,context}=await fixture();
  for(const definition of reviewedDefinitions){
    const recipe=context.recipes.find(r=>r.id===definition.recipeId)!,variant=recipe.variants.find(item=>item.id===definition.variantId)!;
    const unrelated=checkDish(recipe,variant,restricted('鱼',context.restrictionTargets('鱼')),context);
    const fishConflict=variant.lines.some(line=>context.components(line.foodId).some(food=>food.id==='fish'||food.allergens.includes('fish')));
    if(!fishConflict)assert.ok(unrelated.dish,`${recipe.name}: unrelated source-review gaps must not block fish check`);
    for(const leaf of definition.leaves)for(const id of [leaf.foodId,...leaf.equivalentIds]){
      const checked=checkDish(recipe,variant,{...restricted(context.foodById.get(id)!.name,[id],'avoid'),checkSeasonings:false,ingredients:[{id:'available-leaf',foodId:leaf.foodId,name:context.foodById.get(leaf.foodId)!.name,amount:'',basis:'unknown',form:'raw',status:'confirmed',original:'test ingredient'}]},context);
      assert.equal(checked.dish,undefined,`must block ${context.foodById.get(id)!.name} (${id}) in ${recipe.name}`);
    }
  }
  const noReview=context.recipes.find(r=>r.name.includes('白菜'))!;
  const noReviewFish=checkDish({...noReview,source:{...noReview.source,kind:'community'}},noReview.variants[0],restricted('鱼',context.restrictionTargets('鱼')),context);
  assert.ok(noReviewFish.dish,'a recipe without a composition approval can still pass an unrelated explicit-ingredient check');
});
test('全目录食材、别名、类别与已知过敏原逐项执行排除',async()=>{
  const {context}=await fixture();
  const allergens=new Set(context.foods.flatMap(food=>food.allergens));
  for(const food of context.foods){
    const identity=context.verifiedIngredientIdentities?.find(item=>item.foodId===food.id);
    for(const lineRecipe of context.recipes.flatMap(recipe=>recipe.variants.map(variant=>({recipe,variant})))){
      if(!lineRecipe.variant.lines.some(line=>line.foodId===food.id))continue;
      const meal=restricted(food.name,[food.id],'avoid');
      meal.ingredients=lineRecipe.variant.lines.map((line,index)=>({id:`all-food-${index}`,foodId:line.foodId,
        name:context.foodById.get(line.foodId)!.name,amount:'',basis:'unknown',form:'raw',status:'confirmed',original:'test ingredient'}));
      const checked=checkDish(lineRecipe.recipe,lineRecipe.variant,meal,context);
      assert.equal(checked.dish,undefined,`avoid must exclude ${food.name} in ${lineRecipe.recipe.name}`);
      for(const alias of food.aliases){
        const targets=context.restrictionTargets(alias);
        assert.ok(targets.includes(food.id),`restriction alias ${alias} resolves to ${food.name}`);
        const aliasMeal=restricted(alias,targets,'avoid');aliasMeal.ingredients=meal.ingredients;
        assert.equal(checkDish(lineRecipe.recipe,lineRecipe.variant,aliasMeal,context).dish,undefined,
          `alias ${alias} must exclude ${food.name} in ${lineRecipe.recipe.name}`);
      }
      // Any explicitly recorded allergen on a food/identity must be enforced
      // regardless of pantry stock and whether the user requested buying.
      for(const allergen of new Set([...food.allergens,...(identity?.allergens??[])])){
        assert.ok(allergens.has(allergen)||identity?.allergens.includes(allergen),`known allergen ${allergen}`);
        const allergy=restricted(food.name,[food.id],'allergy');allergy.ingredients=meal.ingredients;
        allergy.allowBuy=true;
        assert.equal(checkDish(lineRecipe.recipe,lineRecipe.variant,allergy,context).dish,undefined,
          `allergy must exclude ${food.name} (${allergen}) in ${lineRecipe.recipe.name}`);
      }
    }
  }
  for(const category of context.categories){
    const targets=context.restrictionTargets(category.name);
    assert.deepEqual([...targets].sort(),[...category.targets].sort(),`category target coverage: ${category.name}`);
    for(const target of targets){
      const food=context.foodById.get(target)!;
      for(const {recipe,variant} of context.recipes.flatMap(recipe=>recipe.variants.map(variant=>({recipe,variant})))){
        if(!variant.lines.some(line=>context.components(line.foodId).some(component=>component.id===target)))continue;
        const categoryMeal=restricted(category.name,targets,'avoid');categoryMeal.ingredients=variant.lines.map((line,index)=>({
          id:`category-food-${index}`,foodId:line.foodId,name:context.foodById.get(line.foodId)!.name,amount:'',basis:'unknown',form:'raw',status:'confirmed',original:'test ingredient'}));
        assert.equal(checkDish(recipe,variant,categoryMeal,context).dish,undefined,
          `${category.name} must exclude ${food.name} in ${recipe.name}`);
        const allergyMeal={...categoryMeal,restrictions:[{...categoryMeal.restrictions[0],kind:'allergy' as const}]};
        assert.equal(checkDish(recipe,variant,allergyMeal,context).dish,undefined,
          `${category.name} allergy must exclude ${food.name} in ${recipe.name}`);
      }
    }
  }
});
test('饮食限制不依赖菜谱核验标记：改变后的明列冲突食材仍会被拦截',async()=>{
  const {approved}=await fixture(),definition=reviewedDefinitions[0];
  const snapshot=structuredClone(approved),recipe=snapshot.recipes.find(r=>r.id===definition.recipeId)!;
  recipe.variants[0].lines.push({foodId:'peanut',amount:null,unit:'g',role:'main',basis:'unknown',form:'raw',optional:false,sourceText:'花生'});
  const context=contentContext(snapshot),updated=context.recipes.find(r=>r.id===definition.recipeId)!;
  assert.equal(checkDish(updated,updated.variants[0],restricted('花生',context.restrictionTargets('花生')),context).dish,undefined);
});
test('生成、重推、换菜、口味及收藏复查共用逐方限制，未知限制和健康不被放行',async()=>{
  const {context}=await fixture(),definition=reviewedDefinitions[0],recipe=context.recipes.find(r=>r.id===definition.recipeId)!;
  const base: RecommendationRequest={operationId:'composition-test',meal:restricted('南瓜',[definition.leaves[0].foodId],'avoid'),action:'generate',page:0,selected:[],previous:[]};
  for(const action of ['generate','reroll','replace','variant','page'] as const){
    const result=await recommend(context.recipes,{...base,action,replaceId:recipe.id,selected:[{recipeId:recipe.id,variantId:recipe.variants[0].id}]},{context});
    assert.ok(result.dishes.every(d=>d.recipe.id!==recipe.id),action);
  }
  const pending=structuredClone(base);pending.meal.restrictions[0].status='unknown';
  assert.equal((await recommend(context.recipes,pending,{context})).status,'needs_confirmation');
  assert.equal((await recommend(context.recipes,{...base,meal:{...base.meal,health:true}},{context})).status,'unavailable');
});
test('独立公开核验发布：撤回、缺失、伪造状态与配方变化失败关闭，旧加载器保持原门禁',async()=>{
  const {bundle,review}=await fixture();let withdrawn=false,changed=false;
  const fetcher:typeof fetch=async(input)=>{const url=String(input),isReview=url.includes('release_id=eq.review-test'),id=isReview?'review-test':'base-test';if(url.includes('select=release_id'))return new Response(JSON.stringify(withdrawn&&isReview?[]:[{release_id:id}]));return new Response(JSON.stringify(isReview
    ? (withdrawn?[]:[{payload:changed?{...review,records:review.records.map(r=>({...r,state:'verified-composition'}))}:review}]) : [{payload:bundle}]));};
  const repository=new CloudBaseGalleryRepository({envId:'shiwei-test',publishableKey:'public-key',releaseId:'base-test',hash:galleryBundleHash(bundle),compositionReleaseId:'review-test',compositionHash:compositionHash(review),fetch:fetcher});
  assert.equal((await repository.load(GALLERY_RELEASE)).compositionApprovals?.length,reviewedDefinitions.length);
  changed=true;
  const coldStart=new CloudBaseGalleryRepository({envId:'shiwei-test',publishableKey:'public-key',releaseId:'base-test',hash:galleryBundleHash(bundle),compositionReleaseId:'review-test',compositionHash:compositionHash(review),fetch:fetcher});
  await assert.rejects(coldStart.load(GALLERY_RELEASE),{code:'CONTENT_NOT_READY'});
  changed=false;withdrawn=true;await assert.rejects(repository.load(GALLERY_RELEASE),{code:'CONTENT_NOT_READY'});
  assert.throws(()=>new CloudBaseGalleryRepository({envId:'shiwei-test',publishableKey:'public-key',releaseId:'base-test',hash:galleryBundleHash(bundle),compositionReleaseId:'review-test'}));
});
test('HTTP返回前再查核验发布，执行中撤回不能返回旧通过结论；客户端不能注入核验标记',async()=>{
  const {bundle,review}=await fixture();let reviewReads=0,withdrawOn=Infinity;
  const fetcher:typeof fetch=async(input)=>{const url=String(input),isReview=url.includes('release_id=eq.review-test');if(url.includes('select=release_id'))return new Response(JSON.stringify(isReview?(++reviewReads>=withdrawOn?[]:[{release_id:'review-test'}]):[{release_id:'base-test'}]));return new Response(JSON.stringify(isReview?(++reviewReads>=withdrawOn?[]:[{payload:review}]):[{payload:bundle}]));};
  const repository=new CloudBaseGalleryRepository({envId:'shiwei-test',publishableKey:'public-key',releaseId:'base-test',hash:galleryBundleHash(bundle),compositionReleaseId:'review-test',compositionHash:compositionHash(review),fetch:fetcher});
  const app=await createApp({environment:'preview',origin:'https://test.example',sessionSecret:randomBytes(32),csrfSecret:randomBytes(32),contentSource:'cloudbase',contentRelease:GALLERY_RELEASE,contentRepository:repository});
  try{
    const catalog=(await app.inject('/api/v1/catalog/recipes')).json();assert.equal(catalog.compositionApprovals,undefined);
    const session=await app.inject('/api/v1/auth/session');const headers={cookie:String(session.headers['set-cookie']).split(';')[0],origin:'https://test.example','x-csrf-token':session.json().csrfToken};
    const data={operationId:'evidence-before-publish',meal:restricted('花生',['peanut']),action:'generate',page:0,selected:[],previous:[]};
    assert.equal((await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:{...data,compositionApprovals:[]}})).statusCode,400);
    withdrawOn=reviewReads+2;
    assert.equal((await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:data})).statusCode,503);
  }finally{await app.close();}
});
