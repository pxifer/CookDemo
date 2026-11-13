import {recipeImage} from '../shared/recipe-images';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {galleryContent,type CandidateRow} from '../backend/src/gallery-content';
import {galleryBundleHash,verifyGalleryBundle,type GalleryBundle} from '../backend/src/cloudbase-content';
import {listedIngredients} from './lib/listed-food-curation';
import {sourceIngredients} from './lib/recipe-source-ingredients';
import {ingredientNames,candidateFoodNames} from '../shared/candidate-food-names';

const root='datasets/recipes/expansion-1000';
const base:GalleryBundle=JSON.parse(await readFile(`${root}/base-bundle.json`,'utf8'));
const previous=verifyGalleryBundle(base,galleryBundleHash(base));
const records: {recipeID:string;recipeName:string;ingredients:{name:string;weight:string}[];seasonings:string[];instructions:{description:string;imgLink:string|null}[]}[]=JSON.parse(await readFile(`${root}/source-records.json`,'utf8'));
const sourceVocabulary=[...new Set([...previous.foods.flatMap(f=>[f.name,...f.aliases]),...candidateFoodNames,'大料',...records.flatMap(r=>r.ingredients.map(i=>i.name))])];
if(previous.recipes.length!==341||records.length!==659)throw Error('RECIPE_1000_INPUT_COUNT');
const rows:CandidateRow[]=records.map(r=>{
 const main=r.ingredients.map(i=>`${i.name} ${i.weight}`),steps=r.instructions.map(i=>i.description.trim());
 const category=/汤|羹|煲$/.test(r.recipeName)?'soup':r.ingredients.some(i=>/猪|牛肉|牛腩|羊|鱼|虾|蟹|蛤|蚝|鱿|鸡(?!蛋|精|粉)|鸭|鹅|肉|排骨|腊肠|火腿|培根/.test(i.name))?'meat':'veg';
 const flavor=/糖醋/.test(r.recipeName)?'糖醋':/咖喱/.test(r.recipeName)?'咖喱':/辣椒|辣酱|豆瓣|干辣|小米椒/.test(r.seasonings.join(' '))?'咸鲜带辣':'咸鲜';
 return {dish_key:r.recipeName,flavor,source_uri:`https://www.haodou.com/recipe/${r.recipeID}`,image_url:null,raw_record:{id:`mi-${r.recipeID}`,category,author:'好豆菜谱（MIRecipe公开存档）',source:'mirecipe-public-archive',license:'来源未声明再发布许可证；按D17-02保留公开出处，不冒称取得许可',main,seasonings:r.seasonings,steps,ingredients:listedIngredients({main,seasonings:r.seasonings}),review_notes:['程序核对原字段与完整终态；非试做、营养或医学审核。']}};
});
for(const row of rows){
 row.raw_record.ingredients=sourceIngredients({main:row.raw_record.main!,seasonings:row.raw_record.seasonings!},sourceVocabulary);
}
const vocabulary=sourceVocabulary;
// Food names explicitly used in source directions also participate in restrictions.
for(const row of rows)for(const step of row.raw_record.steps!)for(const name of ingredientNames(step,vocabulary)){
 if(row.raw_record.ingredients!.some(i=>i.name===name)||name.length===1&&!['盐','油','葱','姜','蒜','水','糖','醋','蛋'].includes(name))continue;
 if(['香料','新鲜蔬菜'].includes(name))continue;
 row.raw_record.ingredients!.push({name:name==='油'?'食用油':name,role:'auxiliary',sourceText:`${name}（做法中使用）`,optional:false});
}
const snapshot=galleryContent(previous,rows);
snapshot.recipes.sort((a,b)=>{const x=previous.recipes.findIndex(r=>r.id===a.id),y=previous.recipes.findIndex(r=>r.id===b.id);return (x<0?99999:x)-(y<0?99999:y)||a.id.localeCompare(b.id);});
snapshot.contentVersion='gallery-listed-foods-1000-20261113-v1';snapshot.restrictionScope='listed-foods';
const variants=snapshot.recipes.flatMap(r=>r.variants);
const bundle:GalleryBundle={base:base.base,rows:[...base.rows,...rows].map(row=>({...row,image_url:recipeImage(row.dish_key,row.image_url)??null})),listedFoodSnapshot:snapshot,foodLevelReview:{version:'listed-foods-v1',recipes:snapshot.recipes.length,variants:variants.length,ingredientRows:variants.reduce((n,v)=>n+v.lines.length,0),checkedAt:'2026-11-13'}};
const hash=galleryBundleHash(bundle);verifyGalleryBundle(bundle,hash);
if(snapshot.recipes.length!==1000||new Set(snapshot.recipes.map(r=>r.name)).size!==1000)throw Error('RECIPE_1000_OUTPUT_COUNT');
await writeFile(`${root}/gallery-bundle.json`,JSON.stringify(bundle)+'\n');
const sourceHash=createHash('sha256').update(await readFile(`${root}/source-records.json`)).digest('hex');
await writeFile(`${root}/manifest.json`,JSON.stringify({releaseId:snapshot.contentVersion,hash,baseHash:galleryBundleHash(base),sourceHash,recipes:1000,previousRecipes:341,addedRecipes:659,variants:variants.length,bytes:Buffer.byteLength(JSON.stringify(bundle)),missingImages:snapshot.recipes.filter(r=>!r.imageUrl).length,imagesDeferredByUser:true,source:'https://github.com/bimissing/recipeData',sourceFiles:['recipeData.zip','recipeData-new1.json.zip'],checks:'source-field/identity/structure consistency; not independent manual or medical review'},null,2)+'\n');
await writeFile(`${root}/image-jobs.json`,JSON.stringify(snapshot.recipes.filter(r=>!r.imageUrl).map(r=>({recipeId:r.id,name:r.name,ingredients:r.variants[0].lines.map(l=>snapshot.foods.find(f=>f.id===l.foodId)?.name),steps:r.variants[0].steps,output:`${r.id}.webp`,state:'deferred'})),null,2)+'\n');
console.log(JSON.stringify({recipes:snapshot.recipes.length,variants:variants.length,bytes:Buffer.byteLength(JSON.stringify(bundle)),missingImages:snapshot.recipes.filter(r=>!r.imageUrl).length}));
