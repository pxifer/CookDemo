import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { galleryContent, type CandidateRow } from '../server/gallery-content';
import { reviewedContent } from '../scripts/lib/reviewed-content';
import { curateCandidate } from '../scripts/lib/candidate-curation';
import { contentContext } from '../shared/content';
import { defaultMeal, type RecommendationRequest } from '../shared/types';
import { checkDish, recommend } from '../server/recommendation';
import { inventoryChecks, nutrition } from '../shared/quantity';
import { optionalIngredient, requiredIngredientText } from '../shared/recipe-ingredients';
import { extractText } from '../shared/extraction';
import { findPantryIngredient } from '../shared/ingredient-matching';
import { resolveExtraction } from '../src/meal-input';
import { inputIngredient } from '../src/meal-input';
import { contentSeasonings } from '../src/meal-input';
import { ingredientNames } from '../shared/candidate-food-names';
import { isCookingWater, isSeasoningFood } from '../shared/pantry';
import { recipeLineText, shoppingList } from '../src/recipe-presentation';
import { ingredientDisplayText } from '../shared/recipe-copy';

export async function galleryFixture() {
  const read = async (path: string) => (await readFile(path,'utf8')).split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));
  const raw = [...(await read('docs/data/recipe-cards-v3.jsonl')).filter(c=>c.source==='howtocook'&&c.completeness==='full_process'),...await read('docs/data/recipe-candidates-supplement-v1.jsonl')];
  const rows: CandidateRow[] = raw.map(c=>{ const card=curateCandidate(c)?.record??c; return {dish_key:card.dish_key,flavor:card.flavor,source_uri:card.url,image_url:null,raw_record:card}; });
  return {rows,base:await reviewedContent()};
}

test('145道菜的独立配图映射完整，原图与压缩图均存在',async()=>{
  const {base,rows}=await galleryFixture();
  const images=JSON.parse(await readFile('docs/data/recipe-candidate-images.json','utf8')).generated as {id:string;image:string}[];
  const byId=new Map(images.map(item=>[item.id,item.image]));
  const snapshot=galleryContent(base,rows.map(row=>({...row,image_url:byId.get(row.raw_record.id)??null})));
  assert.equal(snapshot.recipes.length,145);
  assert.equal(new Set(snapshot.recipes.map(recipe=>recipe.imageUrl)).size,145,'各菜使用自己的图片');
  for(const recipe of snapshot.recipes){
    assert(recipe.imageUrl?.startsWith('/assets/recipes/'),recipe.name);
    for(const path of [recipe.imageUrl,recipe.imageUrl!.replace(/\.png$/,'.webp')])assert((await stat(`public${path}`)).size>1000,recipe.name);
  }
});
test('过短的公开做法已按原有配方补充操作分点，且不含内部备注',async()=>{
  const review=JSON.parse(await readFile('docs/data/recipe-step-review-v28.json','utf8')) as {recipes:Record<string,{steps:string[]}>};
  for(const [id,{steps}] of Object.entries(review.recipes)){
    assert(steps.length>=3,`${id} is split into actionable steps`);
    assert.doesNotMatch(steps.join(''),/按原简介|按原文|公开配方资料|保留原始出处|未试做|待核/);
  }
});
test('用量编辑尾注只影响显示，保留食材、已知用量及可选标记',()=>{
  for(const [input,expected] of [
    ['葱（用量未注明）','葱'],['虾仁（未定量）','虾仁'],['食用油：原页未注明用量','食用油'],
    ['胡萝卜（可选，用量未注明）','胡萝卜（可选）'],['盐2g','盐2g'],['黑胡椒（适量）','黑胡椒（适量）'],
  ])assert.equal(ingredientDisplayText(input),expected);
});
test('图鉴全部145道进入本机推荐，每个父菜谱均可翻页召回，旧收藏ID保持',async()=>{
  const {base,rows}=await galleryFixture(),snapshot=galleryContent(base,rows),context=contentContext(snapshot);
  const names=new Set(rows.map(r=>r.dish_key));
  assert.equal(names.size,145); assert.equal(snapshot.recipes.length,145);
  assert.deepEqual(new Set(snapshot.recipes.map(r=>r.name)),names);
  assert.ok(snapshot.recipes.every(r=>r.variants.every(v=>v.lines.some(l=>l.role==='main'&&!l.optional))), 'Every dish must have a recognized required main ingredient');
  assert.ok(snapshot.recipes.every(r=>r.variants.every(v=>v.lines.filter(l=>context.foodById.get(l.foodId)?.name==='水').every(l=>l.role!=='main'))));
  assert.equal(snapshot.recipes.find(r=>r.name==='清蒸鳜鱼')?.variants.length,2,'only the fish has two distinct source flavors');
  assert.equal(snapshot.recipes.find(r=>r.name==='鸡蛋羹')?.variants.length,1,'same-flavor duplicate source is not a second flavor');
  for(const [name,alternateLabel] of [['宫保鸡丁','进阶版'],['回锅肉','简易生炒']] as const){
    const variant=snapshot.recipes.find(recipe=>recipe.name===name)?.variants[0];assert(variant,`${name} has method options`);
    assert(variant.steps.length>0,'the first option becomes an independently numbered primary method');
    assert.equal(variant.methodOptions?.length,1);assert(variant.methodOptions?.[0].label.includes(alternateLabel));assert(variant.methodOptions[0].steps.length>0);
  }
  for(const r of base.recipes)assert.equal(snapshot.recipes.find(n=>n.name===r.name)?.id,r.id);
  const meal={...defaultMeal(),mode:'candidates' as const,allowBuy:true};
  const request:RecommendationRequest={operationId:'gallery-test',meal,action:'generate',page:0,selected:[],previous:[]};
  const found=new Set<string>();
  for(let page=0;page<Math.ceil(names.size/6);page++){
    const result=await recommend(snapshot.recipes,{...request,page},{context});
    assert.equal(result.status,'completed');assert.equal(result.total,145);
    for(const d of result.dishes){assert.ok(d.variant.steps.length);found.add(d.recipe.name);}
  }
  assert.deepEqual(found,names);
  assert.ok(snapshot.recipes.filter(r=>r.source.kind==='local-candidate').every(r=>r.minutes===null&&r.source.reviewed===false&&r.variants.every(v=>v.lines.every(l=>l.amount===null))));
});
test('调料不限库存时，辅料栏中的葱姜蒜不再阻断候选推荐',async()=>{
  const {base,rows}=await galleryFixture(),snapshot=galleryContent(base,rows),context=contentContext(snapshot);
  const recipe=snapshot.recipes.find(r=>r.name==='玉米排骨汤');assert(recipe);
  const variant=recipe.variants[0];
  const ingredientIds=variant.lines.filter(l=>l.role==='main'&&!l.optional).map(l=>l.foodId);
  const meal={...defaultMeal(),mode:'candidates' as const,composition:'custom' as const,counts:{meat:1,veg:0,soup:0},allowBuy:false,checkSeasonings:false,
    ingredients:[...new Set(ingredientIds)].map(foodId=>({id:foodId,foodId,name:context.foodById.get(foodId)!.name,amount:'',basis:'unknown' as const,form:'raw',status:'confirmed' as const,original:context.foodById.get(foodId)!.name}))};
  const auxPantry=variant.lines.filter(l=>['葱','大葱','生姜'].includes(context.foodById.get(l.foodId)?.name??''));
  const result=checkDish(recipe,variant,meal,context);
  assert(auxPantry.length>0);assert(auxPantry.every(l=>l.role==='seasoning'));
  assert.ok(result.dish,`seasonings in auxiliary source fields must follow the unchecked seasoning inventory policy: ${result.reasons.join('；')}`);
  const checked=checkDish(recipe,variant,{...meal,checkSeasonings:true,seasonings:[]},context);
  assert.equal(checked.dish,undefined);assert.ok(checked.reasons.some(reason=>reason.includes('缺少必需调味料')));
});
test('截图中的鸡蛋、牛肉、猪肉、白菜、粉条优先显示完全对应菜谱，同时保留全部候选',async()=>{
  const {base,rows}=await galleryFixture(),snapshot=galleryContent(base,rows),context=contentContext(snapshot);
  assert.equal(snapshot.foods.some(food=>food.name==='粉条'),false,'broad input token stays outside the source food release');
  assert.equal(context.findFood('粉条')?.id,'ingredient-family-vermicelli','the shared runtime context supplies the input token');
  const recipe=snapshot.recipes.find(r=>r.name==='白菜猪肉炖粉条');assert(recipe);
  const found=extractText('鸡蛋，牛肉，猪肉，白菜，粉条',context);
  assert.deepEqual(found.ingredients.map(item=>item.name),['鸡蛋','牛肉','猪肉','白菜','粉条']);
  const staleExtraction={...found,ingredients:found.ingredients.filter(item=>item.name!=='粉条'),unresolved:['粉条'],restrictions:[]};
  const resolved=resolveExtraction(staleExtraction,context);
  assert.deepEqual(resolved.ingredients.map(item=>item.foodId),['egg','beef','pork','cabbage','ingredient-family-vermicelli']);
  assert.deepEqual(resolved.restrictions,[]);
  const meal={...defaultMeal(),mode:'candidates' as const,allowBuy:true,
    ingredients:resolved.ingredients.map(item=>({...item,status:'confirmed' as const,basis:'unknown' as const}))};
  const result=checkDish(recipe,recipe.variants[0],meal,context);
  assert.ok(result.dish,`family matches should not appear as missing shopping items: ${result.reasons.join('；')}`);
  assert.equal(result.dish.checks.length,3);
  assert.equal(result.dish.checks.find(check=>check.name==='五花肉')?.state,'unverified');
  assert.equal(result.dish.checks.find(check=>check.name==='土豆干粉条')?.state,'unverified');
  assert.equal(result.dish.checks.find(check=>check.foodId===context.findFood('大白菜')?.id)?.state,'unverified');
  assert.ok(result.dish.reused.length>=3);
  const pageResult=await recommend(snapshot.recipes,{operationId:'pork-cabbage-vermicelli',meal,action:'generate',page:0,selected:[],previous:[]},{context});
  assert.ok(pageResult.total>pageResult.dishes.length,'all matching candidates remain available through pagination');
  const matched=pageResult.dishes.find(d=>d.recipe.name==='白菜猪肉炖粉条');
  assert.ok(matched,'the best-matching user example is prioritized on the first recommendation page');
  assert.equal(matched.checks.find(check=>check.name==='五花肉')?.state,'unverified');
  assert.equal(matched.checks.find(check=>check.name==='土豆干粉条')?.state,'unverified');
  const allCandidates=new Set(pageResult.dishes.map(d=>d.recipe.id));
  for(let page=1;page<Math.ceil(pageResult.total/6);page++){
    const next=await recommend(snapshot.recipes,{operationId:'pork-cabbage-vermicelli',meal,action:'generate',page,selected:[],previous:[]},{context});
    for(const dish of next.dishes)allCandidates.add(dish.recipe.id);
  }
  assert.equal(allCandidates.size,pageResult.total,'relevance ordering changes page position only and keeps the full qualifying set');
  const riceNoodles={id:'rice-noodles',name:'米粉',aliases:[],unit:'g' as const,form:'raw',allergens:[],componentsComplete:true,nutrition:{}};
  const lookup=new Map(context.foodById).set(riceNoodles.id,riceNoodles);
  assert.equal(findPantryIngredient({foodId:riceNoodles.id,amount:null,unit:'g',role:'main',basis:'unknown',form:'raw'},meal.ingredients,lookup),undefined);
});
test('未核配方按明列食材筛查；无关成分缺口不误拦，未知用量不当0或足量',async()=>{
  const {base,rows}=await galleryFixture(),snapshot=galleryContent(base,rows),context=contentContext(snapshot);
  const meal={...defaultMeal(),allowBuy:true,mode:'candidates' as const,restrictions:[{id:'a',name:'鸡蛋',kind:'allergy' as const,targets:[context.findFood('鸡蛋')!.id],status:'confirmed' as const,scope:'self' as const,original:'鸡蛋过敏'}]};
  const result=await recommend(snapshot.recipes,{operationId:'restricted',meal,action:'generate',page:0,selected:[],previous:[]},{context});
  assert.ok(result.dishes.some(d=>d.recipe.source.kind==='local-candidate'));
  const restrictedTargets=new Set(meal.restrictions.flatMap(r=>r.targets));
  assert.ok(result.dishes.every(d=>d.variant.lines.every(line=>!context.components(line.foodId).some(food=>restrictedTargets.has(food.id)||food.allergens.includes('egg')))));
  const line={foodId:context.findFood('鸡蛋')!.id,amount:null,unit:'个' as const,role:'main' as const,basis:'unknown' as const,form:'raw'};
  const checks=inventoryChecks([line,{...line,amount:2}],1,{...meal,ingredients:[{id:'i',foodId:line.foodId,name:'鸡蛋',amount:'20个',basis:'unknown',form:'raw',status:'confirmed',original:'鸡蛋'}]},context.foodById);
  assert.equal(checks[0].needed,null);assert.equal(checks[0].state,'unverified');
  assert.deepEqual(nutrition([line],1,context.foodById),{kcal:null,protein:null,sodium:null});
});
test('只输入简名可做对应菜，未允许补买时不混入缺少鸡蛋或包菜的菜',async()=>{
  const {base,rows}=await galleryFixture(),snapshot=galleryContent(base,rows),context=contentContext(snapshot);
  const meal={...defaultMeal(),ingredients:['白菜','猪肉','粉条'].map(name=>inputIngredient(name,context))};
  const result=await recommend(snapshot.recipes,{operationId:'simple-pantry-meal',meal,action:'generate',page:0,selected:[],previous:[]},{context});
  assert.ok(result.dishes.some(d=>d.recipe.name==='白菜猪肉炖粉条'));
  assert.ok(result.dishes.every(d=>d.checks.every(check=>check.state!=='missing')));
  assert.ok(!result.dishes.some(d=>d.recipe.name==='包菜炒鸡蛋粉丝'));
  const powderOnly={...defaultMeal(),mode:'candidates' as const,allowBuy:true,ingredients:[inputIngredient('粉条',context)]};
  const related=await recommend(snapshot.recipes,{operationId:'only-vermicelli',meal:powderOnly,action:'generate',page:0,selected:[],previous:[]},{context});
  assert.ok(related.dishes.some(d=>d.recipe.name==='白菜猪肉炖粉条'));
  assert.ok(related.dishes.every(d=>d.variant.lines.some(l=>l.role==='main'&&findPantryIngredient(l,powderOnly.ingredients,context.foodById))));
});
test('食材分类忽略可省/可选项，主料部位选项不等于整项可省',()=>{
  for(const s of ['胡萝卜50g（可省）','芝麻5g（可选）','皮蛋一个（没有也可以不放）','小葱（非必需）'])assert.ok(optionalIngredient(s),s);
  assert.equal(optionalIngredient('牛肉250g（可选牛腩、牛尾肉）'),false);
  assert.equal(requiredIngredientText(['玉米200g','胡萝卜50g（可省）']),'玉米200g');
});

test('调料分类审查：不从操作说明抽取鱼或豆腐，水不检查库存，奶粉蔬菜不当调料',async()=>{
  assert.deepEqual(ingredientNames('盐：约 50g 用于腌制鱼',['盐','鱼']),['盐']);
  assert.deepEqual(ingredientNames('开水至没过豆腐（未定量）',['开水','豆腐']),['开水']);
  assert.deepEqual(ingredientNames('酱油 每个生蚝 1 ml',['酱油','生蚝']),['酱油']);
  const {base,rows}=await galleryFixture(),context=contentContext(galleryContent(base,rows));
  const choices=contentSeasonings(context).map(id=>context.foodById.get(id)!);
  assert(choices.every(f=>isSeasoningFood(f)&&!isCookingWater(f.name)));
  for(const name of ['鱼','豆腐','油麦菜','牛奶','纯牛奶','酸奶','淡奶油','鹰嘴豆粉','糯米粉','粘米粉','可乐'])assert(!choices.some(f=>f.name===name),name);
  for(const name of ['葱段','姜片','蒜末'])assert(!choices.some(f=>f.name===name),'aromatics share their stock entry');
  assert(choices.some(f=>f.id==='ginger'));assert(choices.some(f=>f.name==='鱼露'));
  const fish=context.recipes.find(r=>r.name==='香煎翘嘴鱼')!;
  assert(!fish.variants[0].lines.some(l=>context.foodById.get(l.foodId)?.name==='鱼'));
  const waterLines=context.recipes.flatMap(r=>r.variants.flatMap(v=>v.lines)).filter(l=>isCookingWater(context.foodById.get(l.foodId)!.name));
  assert(waterLines.length>0);
  for(const checkSeasonings of [false,true])assert.deepEqual(inventoryChecks(waterLines,1,{...defaultMeal(),checkSeasonings},context.foodById),[]);
  const beef=context.recipes.find(r=>r.name==='番茄炖牛腩')!;
  assert(beef.variants[0].lines.filter(l=>['葱段','姜片'].includes(context.foodById.get(l.foodId)!.name)).every(l=>l.role==='seasoning'));
  const slicedGinger=beef.variants[0].lines.filter(l=>context.foodById.get(l.foodId)!.name==='姜片');
  assert.equal(slicedGinger.length,1);
  assert.deepEqual(inventoryChecks(slicedGinger,1,{...defaultMeal(),checkSeasonings:true,seasonings:['ginger']},context.foodById),[]);
});

test('补买展示按原方，仅列未选择食材；不限调料不列葱姜，不伪造未知用量',async()=>{
  const {base,rows}=await galleryFixture(),context=contentContext(galleryContent(base,rows));
  const recipe=context.recipes.find(r=>r.name==='番茄炖牛腩')!;
  const meal={...defaultMeal(),allowBuy:true,ingredients:[inputIngredient('牛肉',context)]};
  const dish=checkDish(recipe,recipe.variants[0],meal,context).dish!;
  assert(dish);
  const list=shoppingList([dish],meal,context.foodById);
  assert.deepEqual(list,['西红柿 3-4 个（每个约 200g）']);
  assert.deepEqual(shoppingList([dish],{...meal,allowBuy:false},context.foodById),[]);
  const main=recipe.variants[0].lines.find(l=>l.role==='main')!;
  assert.equal(recipeLineText({...main,sourceText:'西红柿（未单列固定用量）'},context.foodById),'西红柿');
  assert(!list.join('').match(/核对|缺量|无法估算|未注明/));
});
