import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceIngredients} from '../scripts/lib/recipe-source-ingredients';
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
 for(const r of base.listedFoodSnapshot!.recipes)assert.deepEqual(snapshot.recipes.find(n=>n.id===r.id),{...r,imageUrl:recipeImage(r.name,r.imageUrl)});
 for(const r of records){const row=bundle.rows.find(row=>row.raw_record.id===`mi-${r.recipeID}`)!;assert(row);assert.deepEqual(row.raw_record.steps,r.instructions.map((i:any)=>i.description.trim()));assert.deepEqual(row.raw_record.main,r.ingredients.map((i:any)=>`${i.name} ${i.weight}`));assert.deepEqual(row.raw_record.seasonings,r.seasonings);assert.equal(row.image_url,null);}
 assert.equal(manifest.missingImages,659);assert(manifest.bytes<12*1024*1024);
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
