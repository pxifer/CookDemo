import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceIngredients} from '../scripts/lib/recipe-source-ingredients';
import {mergeSourceIngredients} from '../scripts/lib/recipe-source-ingredients';
import {listedIngredients} from '../scripts/lib/listed-food-curation';
import {isInvalidFoodName} from '../shared/ingredient-matching';
import {readFile} from 'node:fs/promises';
import {verifyGalleryBundle,type GalleryBundle} from '../backend/src/cloudbase-content';
import {recipeImage} from '../shared/recipe-images';
import {contentContext} from '../shared/content';
import {defaultMeal} from '../shared/types';
import {checkDish,recommend} from '../backend/src/recommendation';
const root='datasets/recipes/expansion-1000';
test('1000道发布包：来源原字段一致、原341道ID/配方不变，659道不借用照片',async()=>{
 const bundle:GalleryBundle=JSON.parse(await readFile(`${root}/gallery-bundle.json`,'utf8')),manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
 const base:GalleryBundle=JSON.parse(await readFile(`${root}/base-bundle.json`,'utf8')),records=JSON.parse(await readFile(`${root}/source-records.json`,'utf8'));
 const snapshot=verifyGalleryBundle(bundle,manifest.hash);assert.equal(snapshot.recipes.length,1000);assert.equal(new Set(snapshot.recipes.map(r=>r.id)).size,1000);assert.equal(new Set(snapshot.recipes.map(r=>r.name)).size,1000);
 for(const r of base.listedFoodSnapshot!.recipes){
  // The base keeps its reviewed text; only parse artefacts (g/ml/瓣) are dropped, so the
  // comparison applies the same filter instead of pretending the base is untouched.
  const invalid=new Set(base.listedFoodSnapshot!.foods.filter(f=>isInvalidFoodName(f.name)).map(f=>f.id));
  const expected={...r,imageUrl:recipeImage(r.name,r.imageUrl),variants:r.variants.map(v=>({...v,lines:v.lines.filter(l=>!invalid.has(l.foodId))}))};
  assert.deepEqual(snapshot.recipes.find(n=>n.id===r.id),expected);
 }
 for(const recipe of snapshot.recipes)for(const variant of recipe.variants)for(const line of variant.lines){
  const name=snapshot.foods.find(f=>f.id===line.foodId)!.name;
  assert(!isInvalidFoodName(name),`${recipe.name}/${name}`);
 }
 for(const r of records){const row=bundle.rows.find(row=>row.raw_record.id===`mi-${r.recipeID}`)!;assert(row);assert.deepEqual(row.raw_record.steps,r.instructions.map((i:any)=>i.description.trim()));assert.deepEqual(row.raw_record.main,r.ingredients.map((i:any)=>`${i.name} ${i.weight}`));assert.deepEqual(row.raw_record.seasonings,r.seasonings);assert.equal(row.image_url,null);}
 assert.equal(manifest.missingImages,659);assert(manifest.bytes<12*1024*1024);
});
test('用量不变成食材：结构化用量与粘连量词都在源头拆开',()=>{
 const items=listedIngredients({main:[{name:'菠菜',amount:'几颗'},{name:'莲藕',amount:'两节'},{name:'豆腐',amount:'旭阳豆腐一盒（2.8元）'}],
   seasonings:['大蒜几瓣','油一汤匙','娃娃菜数片','盐一点点','葱一小段']});
 assert.deepEqual(items.map(i=>i.name),['菠菜','莲藕','豆腐','大蒜','食用油','娃娃菜','盐','葱']);
 assert(items.find(i=>i.name==='菠菜')!.sourceText.includes('几颗'));
 assert(items.find(i=>i.name==='大蒜')!.sourceText==='大蒜几瓣');
});
test('调料串是句子时整段丢弃，不猜食材形态',()=>{
 const items=mergeSourceIngredients(listedIngredients({seasonings:['辣椒按口味放','淡奶看口味吧','喜欢奶油口味就多放点','起士能吧你盛豆腐的器皿口铺满','食盐适量']}),['辣椒','淡奶','干辣椒']);
 assert.deepEqual(items.map(i=>i.name),['食盐']);
});
test('1000道发布包：新增659道没有用量词混进食材，真实食材不被误删',async()=>{
 const bundle:GalleryBundle=JSON.parse(await readFile(`${root}/gallery-bundle.json`,'utf8')),manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
 const base:GalleryBundle=JSON.parse(await readFile(`${root}/base-bundle.json`,'utf8'));
 const snapshot=verifyGalleryBundle(bundle,manifest.hash),names=new Set(snapshot.foods.map(f=>f.name)),byId=new Map(snapshot.foods.map(f=>[f.id,f.name]));
 // The frozen 341 base keeps its reviewed text (its own "瓣" line is left to the picker filter).
 const baseIds=new Set(base.listedFoodSnapshot!.recipes.map(r=>r.id)),added=new Set<string>();
 for(const r of snapshot.recipes)if(!baseIds.has(r.id))for(const v of r.variants)for(const l of v.lines)added.add(byId.get(l.foodId)!);
 for(const dirty of ['几个','几颗','几片','一大块','两节','二棵','一朵','中等','一到','瓣','娃娃菜数片','干辣椒几个','盐一点点','姜一小片','姜小块','大蒜几瓣','生姜一小块','葱一小段','油一汤匙','旭阳豆腐一盒'])assert(!added.has(dirty),dirty);
 for(const real of ['千张','菠菜','豆腐','大蒜','葱'])assert(names.has(real),real);
});

test('1000道逐方业务校验：可推荐、补买、明列配料限制不能绕过',async()=>{
 const bundle:GalleryBundle=JSON.parse(await readFile(`${root}/gallery-bundle.json`,'utf8')),context=contentContext(bundle.listedFoodSnapshot!);let checked=0;
 for(const recipe of context.recipes){
  for(const variant of recipe.variants){
   const meal={...defaultMeal(),allowBuy:true};
   assert.equal(Boolean(checkDish(recipe,variant,meal,context).dish),true,recipe.name);
   for(const foodId of new Set(variant.lines.map(l=>l.foodId))){
    const name=context.foodById.get(foodId)!.name;
    const restricted={...meal,restrictions:[{id:'test',name,kind:'allergy' as const,scope:'self' as const,status:'confirmed' as const,targets:[foodId],original:name}]};
    assert.equal(Boolean(checkDish(recipe,variant,restricted,context).dish),false,`${recipe.name}/${name}`);checked++;
   }
  }
 }
 assert(checked>5000);
 const req={operationId:crypto.randomUUID(),meal:{...defaultMeal(),mode:'candidates' as const,allowBuy:true},action:'generate' as const,page:0,previous:[],selected:[]};
 const result=await recommend(context.recipes,req,{context});assert.equal(result.status,'completed');assert(result.dishes.length>0);assert(result.cursor);
 const next=await recommend(context.recipes,{...req,operationId:crypto.randomUUID(),action:'page',page:1,cursor:result.cursor},{context});assert.equal(next.status,'completed');assert(!next.dishes.some(d=>result.dishes.some(old=>old.recipe.id===d.recipe.id)));
});

test('来源配料拼接和约量不变成一个食材，不给组合用量补造单项克重',()=>{
 const items=sourceIngredients({main:['榛蘑大概10根'],seasonings:['葱姜大料红辣椒冰糖甘草适量适量','葱姜10克']},['榛蘑','葱','姜','大料','红辣椒','冰糖','甘草']);
 assert.equal(items[0].name,'榛蘑');assert.deepEqual(items.slice(1,7).map(i=>i.name),['葱','姜','大料','红辣椒','冰糖','甘草']);assert(items.slice(1).every(i=>!i.sourceText.includes('10')));
});
