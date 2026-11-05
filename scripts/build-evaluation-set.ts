import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { galleryBundleHash,verifyGalleryBundle,type GalleryBundle } from '../backend/src/cloudbase-content';
import type { KnowledgeBundle } from '../shared/health-knowledge';
const source=process.argv[2]??'.local-data/cloudbase-http/listed-foods-20261026-v28-final/gallery-bundle.json';
const bytes=await readFile(source),bundle:GalleryBundle=JSON.parse(bytes.toString()),content=verifyGalleryBundle(bundle,galleryBundleHash(bundle));
const knowledge:KnowledgeBundle=JSON.parse(await readFile('datasets/health/2026-10-28-v2/knowledge-bundle.json','utf8'));
const recipes=content.recipes.filter(r=>r.state==='published').sort((a,b)=>a.id.localeCompare(b.id));
const used=new Set(recipes.flatMap(r=>r.variants.flatMap(v=>v.lines.filter(l=>l.role==='main').map(l=>l.foodId))));
const foods=content.foods.filter(f=>used.has(f.id)).sort((a,b)=>a.id.localeCompare(b.id));
if(foods.length<25||recipes.length<30)throw Error('EVALUATION_CATALOG_TOO_SMALL');
const cases:unknown[]=[];
const add=(dimension:string,clusterId:string,index:number,input:unknown,expectation:unknown)=>cases.push({id:`${dimension}-${String(index+1).padStart(3,'0')}`,dimension,clusterId,split:parseInt(createHash('sha256').update(clusterId).digest('hex').slice(0,8),16)%10<3?'development':'holdout_candidate',input,expectation,annotation:{author:'Codex',status:'candidate',reviewers:[],reviewedAt:null,sourceVerified:false}});
for(let i=0;i<40;i++){const food=foods[Math.floor(i/2)];add('recognition',`recognition:${food.id}`,i,{text:`${i%2?food.aliases[0]??food.name:food.name}100${food.unit}`},{foodId:food.id,amount:`100${food.unit}`,unknownIsNotZero:true});}
for(let i=0;i<50;i++){const food=foods[Math.floor(i/2)];add('allergy',`allergy:${food.id}`,i,{foodName:food.name,kind:i%2?'avoid':'allergy',allowBuy:Boolean(i%2)},{listedFoodId:food.id,forbiddenVariants:recipes.flatMap(r=>r.variants.filter(v=>v.lines.some(l=>l.foodId===food.id&&!l.optional)).map(v=>({recipeId:r.id,variantId:v.id}))),mustNotLoosenRestriction:true});}
const diseases=[...knowledge.entities.filter(e=>e.kind==='disease').map(e=>({id:e.id,name:e.name})),{id:'ambiguous-diabetes',name:'糖尿病未分型'},{id:'unsupported',name:'本库未覆盖的疾病'}];
for(let i=0;i<50;i++){const disease=diseases[Math.floor(i/5)%diseases.length];add('disease',`disease:${disease.id}`,i,{concern:disease.name,scenario:['conditions_missing','multiple_concerns','conflicting_advice','unknown_food_form','source_withdrawn'][i%5]},{sourceFactIds:knowledge.facts.filter(f=>f.subjectId===disease.id).slice(0,5).map(f=>f.id),clinicalApproval:false,noCureClaim:true,unknownIsNotSafe:true,requiresQualifiedReview:true});}
for(let i=0;i<30;i++){const recipe=recipes[Math.floor(i/2)];add('reasonableness',`recommendation:${recipe.id}`,i,{recipeId:recipe.id,allowBuy:Boolean(i%2),task:i%2?'single_replacement':'generate'},{category:recipe.category,onlyCatalogIds:true,preserveMealConstraints:true,reasonMustUseActualIngredients:true});}
for(let i=0;i<30;i++){const recipe=recipes[15+Math.floor(i/2)],variant=recipe.variants[0];add('method',`method:${recipe.id}`,i,{recipeId:recipe.id,variantId:variant.id,task:i%2?'alternative_method':'primary_method'},{sourceStepCount:variant.steps.length,lastSourceStep:variant.steps.at(-1),methodLabels:variant.methodOptions?.map(m=>m.label)??[],noInventedSteps:true,noMethodMixing:true});}
const dataset={id:'agent-evaluation-candidates-2026-10-29-v1',status:'candidate_not_independent',sourceContentVersion:content.contentVersion,sourceBundleSha256:createHash('sha256').update(bytes).digest('hex'),knowledgeBundle:knowledge.id,total:cases.length,cases,note:'200 source-derived candidate tasks for human review; not an independently annotated or passed benchmark. Image recognition excluded from this release.'};
const out='datasets/evaluation';await mkdir(out,{recursive:true});await writeFile(`${out}/agent-candidates-v1.json`,JSON.stringify(dataset,null,2)+'\n');await writeFile(`${out}/catalog-snapshot-v1.json`,JSON.stringify(content)+'\n');
console.log(JSON.stringify({total:cases.length,recipes:recipes.length,status:dataset.status,dimensions:{recognition:40,allergy:50,disease:50,reasonableness:30,method:30}}));
