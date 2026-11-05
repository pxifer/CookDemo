import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {galleryContent,type CandidateRow} from '../backend/src/gallery-content';
import {galleryBundleHash,verifyGalleryBundle,type GalleryBundle} from '../backend/src/cloudbase-content';
import {listedIngredients} from './lib/listed-food-curation';
import {ingredientNames,candidateFoodNames} from '../shared/candidate-food-names';
import {isCookingWater,isSeasoningFood} from '../shared/pantry';
import {listedFoodKeys} from '../shared/food-restrictions';
import corrections from '../datasets/recipes/curation/composition-review-v2.json';

export const RELEASE_ID='gallery-listed-foods-20261026-v27';
const root='.local-data/cloudbase-http/listed-foods-20261026-v27';
const read=async(path:string)=>(await readFile(path,'utf8')).trim().split(/\r?\n/).map(line=>JSON.parse(line));
const original:GalleryBundle=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261023/gallery-bundle.json','utf8'));
const extra=[...await read('datasets/recipes/curation/recipe-expansion-simple-v1.jsonl'),...await read('datasets/recipes/curation/recipe-original-drafts-2026-10-26.jsonl')];
const excluded:Record<string,string>={
  R224:'原料栏混入调料且部分列料未在做法交代用途，待对照原方。',
  R184:'原文存在多处转写错误及禽肉熟制条件不清。',
  R142:'原文存在转写错误和封堵漏汽的器具操作，暂缓发布。',
  R139:'菜名转写存疑，待对照原方确认。',
  R021:'肉馅未明确动物来源，无法可靠关联食品级限制。',
  R138:'肉末未明确动物来源，无法可靠关联食品级限制。',
};
const records=extra.filter(row=>!excluded[row.recipe.id]).map(row=>{
  const card=structuredClone(row.recipe);
  if(card.id==='R123')card.steps=card.steps.map((step:string)=>step.replaceAll('脚背','茭白'));
  if(card.id==='R209')card.category='meat';
  return {dish_key:card.dish_key,flavor:card.flavor,source_uri:card.url,image_url:null,
    raw_record:{...card,license:card.source==='shiwei-original-draft'?'拾味自编配方':'公开配方资料；保留原始出处',foodLevelReviewed:true,
      ingredients:listedIngredients(card),review_notes:card.source==='shiwei-original-draft'?['拾味自编家常配方，用量为参考。']:[]}} as CandidateRow;
});
const vocabulary=[...new Set([...original.base.foods.flatMap(food=>[food.name,...food.aliases]),...candidateFoodNames,
  ...records.flatMap(row=>row.raw_record.ingredients!.map(item=>item.name))])];
// Record named foods used in the method as well as the ingredient table. Match
// complete food names first so 蒸鱼豉油 does not create an invented 鱼 entry.
for(const row of records){
  for(const step of row.raw_record.steps??[]){
    for(const name of ingredientNames(step,vocabulary)){
      if(row.raw_record.ingredients!.some(item=>item.name===name))continue;
      if(name.length===1&&!['盐','油','葱','姜','蒜','水','糖','醋','蛋'].includes(name))continue;
      if(['香料','新鲜蔬菜'].includes(name))continue;
      row.raw_record.ingredients!.push({name:name==='油'?'食用油':name,role:'auxiliary',sourceText:`${name}（做法中使用）`,optional:false});
    }
  }
}
const rows=[...original.rows.map(row=>({...row,raw_record:{...row.raw_record,foodLevelReviewed:true}})),...records];
const snapshot=galleryContent(original.base,rows);
snapshot.restrictionScope='listed-foods';
snapshot.contentVersion=RELEASE_ID;
snapshot.contentState='database-reviewed';
snapshot.relations=[];
// Retain the already documented explicit list corrections. Composition review
// fingerprints are not inputs to the newly approved food-level restriction model.
for(const correction of corrections.corrections as any[]){
  const recipe=snapshot.recipes.find(item=>item.id===correction.recipeId),variant=recipe?.variants.find(item=>item.id===correction.variantId);
  if(!recipe||!variant)throw Error('LISTED_SOURCE_CORRECTION_MISSING');
  for(const line of variant.lines)if(correction.optionalFoodIds.includes(line.foodId))line.optional=true;
  for(const line of correction.addLines)if(!variant.lines.some(item=>item.foodId===line.foodId))variant.lines.push(line);
  if(correction.appendSteps)variant.steps.push(...correction.appendSteps);
}
for(const recipe of snapshot.recipes){
  recipe.source={...recipe.source,reviewed:true,reviewBasis:'source-and-structure'};
  if(recipe.source.uri?.includes('github.com/Anduin2017/HowToCook/'))recipe.source.license='The Unlicense';
  for(const variant of recipe.variants){
    variant.reviewNotes=(variant.reviewNotes??[]).filter(note=>!note.includes('内部候选')&&!note.includes('成分')&&!note.includes('待核'));
    for(const line of variant.lines){
      const food=snapshot.foods.find(item=>item.id===line.foodId);if(!food)throw Error('LISTED_FOOD_MISSING');
      line.sourceText??=`${food.name}${line.amount===null?'':` ${line.amount}${line.unit}`}`;
      if(isCookingWater(food.name)||isSeasoningFood(food))line.role='seasoning';
    }
    variant.lines=variant.lines.filter((line,index)=>variant.lines.findIndex(item=>item.foodId===line.foodId&&item.role===line.role&&!!item.optional===!!line.optional)===index);
  }
}
// Food categories describe visibly listed food groups. No packaged-condiment
// label, nutrient, allergen-component or chemical-composition inference is made.
const category=(name:string,aliases:string[],pattern:RegExp,exclude?:RegExp)=>({name,aliases,targets:snapshot.foods.filter(food=>pattern.test(food.name)&&!exclude?.test(food.name)).map(food=>food.id),note:'按菜谱明列食品名称筛选'});
snapshot.categories=[
  category('海产品',['海鲜'],/鱼|虾|蟹|蛤|贝|蚝|蛏|鱿|墨鱼|鱔|鳝/,/酱|汁|油|汤|调料/),
  category('蛋类',[],/^(鸡蛋|鸡蛋黄|蛋清|蛋黄|蛋液|皮蛋|咸鸭蛋|鸭蛋|鸽子蛋|鹌鹑蛋)$/),
  category('豆类',['大豆'],/^(黄豆|生黄豆|黑豆|蚕豆|豌豆|青豆|芸豆|鹰嘴豆)$/),
  category('乳类',['奶类'],/^(牛奶|纯牛奶|酸奶|原味酸奶|淡奶油|黄油|无盐黄油|甜炼乳)$/),
  category('坚果',[],/^(腰果|杏仁|花生|花生米|熟花生|熟花生米|熟松子仁|板栗|栗子)$/),
];
const variants=snapshot.recipes.flatMap(recipe=>recipe.variants);
const review={version:'listed-foods-v1' as const,recipes:snapshot.recipes.length,variants:variants.length,
  ingredientRows:variants.reduce((sum,variant)=>sum+variant.lines.length,0),checkedAt:'2026-10-26'};
const bundle:GalleryBundle={...original,rows,listedFoodSnapshot:snapshot,foodLevelReview:review};
const hash=galleryBundleHash(bundle);verifyGalleryBundle(bundle,hash);
const suspicious=records.flatMap(row=>row.raw_record.ingredients!.filter(item=>item.name.length>10||/[=≥：:]/.test(item.name)).map(item=>({id:row.raw_record.id,name:item.name})));
if(suspicious.length)throw Error(`LISTED_INGREDIENT_NEEDS_REVIEW_${JSON.stringify(suspicious)}`);
await mkdir(root,{recursive:false});
await cp('.local-data/cloudbase-http/composition-review-20261025-v10/migration',`${root}/migration`,{recursive:true});
const payload=JSON.stringify(bundle),sql=`
INSERT INTO public.shiwei_gallery_releases(release_id,checksum,payload,published) VALUES('${RELEASE_ID}','${hash}','${payload.replaceAll("'","''")}'::jsonb,true);
CREATE TABLE public.shiwei_food_identity_records (
 release_id text REFERENCES public.shiwei_gallery_releases(release_id),food_id text NOT NULL,name text NOT NULL,aliases jsonb NOT NULL,food_keys jsonb NOT NULL,
 PRIMARY KEY(release_id,food_id));
CREATE TABLE public.shiwei_recipe_food_records (
 release_id text REFERENCES public.shiwei_gallery_releases(release_id),recipe_id text NOT NULL,variant_id text NOT NULL,ordinal integer NOT NULL,
 food_id text NOT NULL,food_name text NOT NULL,role text NOT NULL CHECK(role IN ('main','auxiliary','seasoning')),optional boolean NOT NULL,source_text text NOT NULL,
 PRIMARY KEY(release_id,recipe_id,variant_id,ordinal),FOREIGN KEY(release_id,food_id) REFERENCES public.shiwei_food_identity_records(release_id,food_id));
ALTER TABLE public.shiwei_food_identity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiwei_recipe_food_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shiwei_food_identity_records,public.shiwei_recipe_food_records FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shiwei_food_identity_records,public.shiwei_recipe_food_records TO anon,authenticated;
CREATE POLICY published_food_identities ON public.shiwei_food_identity_records FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.shiwei_gallery_releases r WHERE r.release_id=shiwei_food_identity_records.release_id AND r.published));
CREATE POLICY published_recipe_foods ON public.shiwei_recipe_food_records FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.shiwei_gallery_releases r WHERE r.release_id=shiwei_recipe_food_records.release_id AND r.published));
`;
const identityRows=snapshot.foods.map(food=>`('${RELEASE_ID}','${food.id.replaceAll("'","''")}','${food.name.replaceAll("'","''")}','${JSON.stringify(food.aliases).replaceAll("'","''")}'::jsonb,'${JSON.stringify(listedFoodKeys(food)).replaceAll("'","''")}'::jsonb)`).join(',\n');
const matrix=snapshot.recipes.flatMap(recipe=>recipe.variants.flatMap(variant=>variant.lines.map((line,ordinal)=>({recipeId:recipe.id,variantId:variant.id,ordinal,...line,foodName:snapshot.foods.find(food=>food.id===line.foodId)!.name}))));
const foodRows=matrix.map(line=>`('${RELEASE_ID}','${line.recipeId}','${line.variantId}',${line.ordinal},'${line.foodId}','${line.foodName.replaceAll("'","''")}','${line.role}',${Boolean(line.optional)},'${line.sourceText!.replaceAll("'","''")}')`).join(',\n');
await writeFile(`${root}/migration/cloudbase/migrations/20261026120000_listed_food_expansion.sql`,sql+`\nINSERT INTO public.shiwei_food_identity_records VALUES ${identityRows};\nINSERT INTO public.shiwei_recipe_food_records VALUES ${foodRows};\nNOTIFY pgrst,'reload schema';\n`,{flag:'wx'});
const manifest={releaseId:RELEASE_ID,hash,...review,foods:snapshot.foods.length,rows:rows.length,newDishes:snapshot.recipes.length-145,
  excluded:extra.filter(row=>excluded[row.recipe.id]).map(row=>({id:row.recipe.id,name:row.dish_key,reason:excluded[row.recipe.id]})),
  sourceRecordHashes:records.map(row=>({id:row.raw_record.id,hash:createHash('sha256').update(JSON.stringify(row.raw_record)).digest('hex')})),
  restrictionScope:'listed-foods',healthEnabled:false,chemicalCompositionInferred:false,bytes:Buffer.byteLength(payload)};
await writeFile(`${root}/gallery-bundle.json`,JSON.stringify(bundle),{flag:'wx'});
await writeFile(`${root}/manifest.json`,JSON.stringify(manifest,null,2),{flag:'wx'});
await writeFile('datasets/recipes/curation/recipe-listed-foods-v27.json',JSON.stringify({releaseId:RELEASE_ID,hash,recipes:snapshot.recipes.map(recipe=>({id:recipe.id,name:recipe.name,source:recipe.source,variants:recipe.variants.map(variant=>({id:variant.id,flavor:variant.flavor,ingredients:matrix.filter(line=>line.variantId===variant.id)}))})),excluded:manifest.excluded},null,2),{flag:'wx'});
console.log(JSON.stringify({...manifest,sourceRecordHashes:undefined}));
