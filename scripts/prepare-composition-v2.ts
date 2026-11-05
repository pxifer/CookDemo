import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyGalleryBundle} from '../backend/src/cloudbase-content';
import {compositionFingerprint,compositionHash,COMPOSITION_BASE_HASH} from '../backend/src/composition-review';
import {ingredientEvidence} from '../shared/ingredient-evidence';
import type {Line} from '../shared/types';
const root='artifacts/acceptance/composition-v2-2026-10-24';
const plans=[
  {id:'R396',coverage:'核必备、计算及5步。萝卜由附加内容明确可省，品种不明时仍未核准，仅实际省略时通过；仅固定基础调味，不包含附加自由加生抽/芝麻等方案。',equivalents:{蒜头:['大蒜'],姜片:['生姜'],小米辣:['干辣椒']},optional:['萝卜'],add:[],unresolved:['萝卜']},
  {id:'R318',coverage:'核必备、计算及11步；花菜、大蒜、盐、油、炒制水完整。焯水1000ml为操作水，不冒充投料。',equivalents:{},optional:[],add:[]},
  {id:'R415',coverage:'核必备、计算及9步；韭菜、鸡蛋、油、盐完整。油10ml与步骤另加5ml总量未定，只核成分，不推算用量或营养。',equivalents:{},optional:[],add:[]},
  {id:'R270',coverage:'核必备、计算及8步；菠菜、鸡蛋、油15ml、盐5g、投料水100ml与既有来源版本一致。',equivalents:{},optional:[],add:[]},
  {id:'R308',coverage:'核必备、计算及9步；西红柿在必备中明确可选，未放时跳过对应处理；食用盐对应盐。',equivalents:{食用盐:['盐']},optional:['西红柿'],add:[]},
  {id:'R271',coverage:'核必备、计算、5步及附加鸡蛋说明；鸡蛋明确可省，补收步骤3的水。不包含附加的自由滴油变体。',equivalents:{},optional:['鸡蛋'],add:[['饮用水','步骤3：加水没过食材总高度约1.1倍','seasoning',false]]},
  {id:'R315',coverage:'核必备、计算、备料及汤锅/电压力锅两个分支；补收出锅的盐和炖汤水。排骨动物身份未由原文明确，保留未核准，不因此放行。只核虾皮原方，不使用附加瑶柱替换；虾皮属虾，不冒充鱼类。',equivalents:{虾皮:['虾']},optional:[],add:[['盐','出锅调味：每250ml汤，盐约0.3～0.6g','seasoning',false],['饮用水','汤锅1100ml水或电压力锅1000ml水，二选一','seasoning',false]],unresolved:['排骨']},
  {id:'R365',coverage:'核必备、计算、5步和可选虾说明；葱花对应葱，清水/水对应饮用水；补收原方明确可选虾仁，虾皮亦可省。不采用附加浓稠加淀粉方案。',equivalents:{葱花:['葱'],虾皮:['虾'],水:['饮用水'],清水:['饮用水']},optional:['虾皮'],add:[['虾','原方必备：虾仁（个人口味，可加可不加）','auxiliary',true]]},
  {id:'R299',coverage:'核必备、计算及8步；补收步骤4油15ml、步骤6水及步骤8关火。味素可省且来源未核，只在实际省略时通过，不能据本审查放行未知味素。',equivalents:{},optional:[],add:[['食用油','步骤4：放入15毫升油','seasoning',false],['饮用水','步骤6：水高约为锅内菜品高度的1.2倍','seasoning',false]],unresolved:['味素'],finalStep:'等待30秒，关火出锅。'},
] as const;
async function main(){
  await mkdir(root,{recursive:true});
  const bundle=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261023/gallery-bundle.json','utf8'));
  const snapshot=verifyGalleryBundle(bundle,COMPOSITION_BASE_HASH),original=structuredClone(snapshot);
  const food=(name:string)=>{const found=snapshot.foods.find(f=>f.name===name);if(!found)throw Error('FOOD_NOT_FOUND:'+name);return found;};
  const corn=food('玉米'),fish=food('鱼');
  const fishNames=new Set(['鳝丝','鳝鱼','昂刺鱼','沙光鱼','桂鱼','鳜鱼','草鱼','鲤鱼','鱼头','白鱔','剑骨鱼','翘嘴鱼','鳊鱼','鱼露','鱼丸']);
  const cornNames=new Set(['玉米粒','玉米淀粉','玉米粉','玉米面','玉米油','甜玉米','罐头甜玉米','玉米糖浆']);
  const relations=snapshot.foods.flatMap(f=>fishNames.has(f.name)?[{foodId:f.id,relatedFoodId:fish.id,kind:'contains' as const,evidence:'原方配料明确命名鱼种、鱼露或鱼丸；仅确认含鱼，不据此断言其余成分完整。'}]:cornNames.has(f.name)?[{foodId:f.id,relatedFoodId:corn.id,kind:'contains' as const,evidence:'原方明确命名玉米/玉米粒/玉米淀粉；只确认玉米来源，不把库存简名匹配当作成分证明。'}]:[]);
  const unresolvedComponents=snapshot.foods.filter(f=>['淀粉','生粉','水淀粉'].includes(f.name)).map(f=>({foodId:f.id,evidence:'通用淀粉/生粉未指明谷类、薯类或豆类来源；不能宣称不含玉米或小麦。市场监管总局淀粉及淀粉制品审查细则。'}));
  const corrections:any[]=[],definitions:any[]=[];
  const sources=JSON.parse(await readFile(`${root}/github-sources.json`,'utf8'));
  for(const plan of plans){
    const recipe=snapshot.recipes.find(r=>r.source.recordId===plan.id);if(!recipe)throw Error('RECIPE_NOT_FOUND');const variant=recipe.variants[0];
    const source=sources.find((s:any)=>s.id===plan.id),path=decodeURIComponent(recipe.source.uri!.split('/0e106eea348c734fe1586f781202994439cf98a5/')[1]??'');
    if(!source||source.commit!=='0e106eea348c734fe1586f781202994439cf98a5'||source.path!==path)throw Error('SOURCE_COMMIT_OR_PATH');
    const text=source.text,bytes=Buffer.from(text,'utf8');
    if(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex')!==source.blobSha)throw Error('SOURCE_BLOB_MISMATCH');
    if(!text.includes('## 操作')||text.includes('爱料理'))throw Error('SOURCE_SCOPE');
    await writeFile(`${root}/${plan.id}-source.md`,bytes,{flag:'wx'});const sourceSha256=createHash('sha256').update(bytes).digest('hex');
    const correction:any={recipeId:recipe.id,variantId:variant.id,baseFingerprint:compositionFingerprint(recipe,variant,snapshot),sourceRecord:plan.id,sourceSha256,optionalFoodIds:plan.optional.map(foodName=>food(foodName).id),addLines:plan.add.map(([name,sourceText,role,optional])=>({foodId:food(name).id,amount:null,unit:food(name).unit,role,basis:'unknown',form:food(name).form,optional,sourceText}))};
    if('finalStep' in plan)correction.appendSteps=[plan.finalStep];
    // Record corrections against the unmodified original. Apply before binding
    // fingerprints, never silently mutate the previous public release.
    for(const line of variant.lines)if(correction.optionalFoodIds.includes(line.foodId))line.optional=true;
    variant.lines.push(...correction.addLines as Line[]);if(correction.appendSteps)variant.steps.push(...correction.appendSteps);
    if(correction.optionalFoodIds.length||correction.addLines.length||correction.appendSteps)variant.ingredientNotes=[...(variant.ingredientNotes??[]),...correction.addLines.map((line:Line)=>line.sourceText)];
    if(correction.optionalFoodIds.length||correction.addLines.length||correction.appendSteps)corrections.push(correction);
    const equivalentNames=plan.equivalents as Record<string,readonly string[]>;
    const leaves=[...new Set(variant.lines.map(l=>l.foodId))].map(id=>({foodId:id,equivalentIds:(equivalentNames[snapshot.foods.find(f=>f.id===id)!.name]??[]).map(name=>food(name).id),evidence:plan.coverage,...('unresolved' in plan&&plan.unresolved.some(name=>food(name).id===id)?{verified:false}:{})}));
    definitions.push({reviewId:`composition-${plan.id.toLowerCase()}-v2`,recipeId:recipe.id,variantId:variant.id,sourceRecord:plan.id,sourceSha256,sourceCoverage:plan.coverage,leaves});
  }
  snapshot.relations=[...(snapshot.relations??[]),...relations.map(({foodId,relatedFoodId,kind})=>({foodId,relatedFoodId,kind}))];
  (snapshot as any).unresolvedComponents=unresolvedComponents.map(f=>f.foodId);
  for(const definition of definitions){const r=snapshot.recipes.find(r=>r.id===definition.recipeId)!,v=r.variants.find(v=>v.id===definition.variantId)!;definition.fingerprint=compositionFingerprint(r,v,snapshot,definition.leaves.flatMap((l:any)=>l.equivalentIds));}
  const evidence=ingredientEvidence(original),inventory=original.recipes.flatMap(r=>r.variants.map(v=>({recipeId:r.id,variantId:v.id,name:r.name,sourceRecord:r.source.recordId,sourceUri:r.source.uri,ingredients:v.lines.map(l=>({foodId:l.foodId,name:original.foods.find(f=>f.id===l.foodId)!.name,sourceText:l.sourceText,optional:l.optional,role:l.role,evidenceState:evidence.find(e=>e.foodId===l.foodId)!.reviewState})),sourceReview:definitions.some(d=>d.variantId===v.id)?'individually-checked-v2':r.source.recordId==='R382'||r.source.recordId==='R380'?'verified-v1':'pending-individual-evidence'})));
  const data={definitions,corrections,relations,unresolvedComponents};
  await writeFile('datasets/recipes/curation/composition-review-v2.json',JSON.stringify(data,null,2));
  await writeFile(`${root}/all-recipe-ingredient-inventory.json`,JSON.stringify(inventory,null,2),{flag:'wx'});
  await writeFile(`${root}/preparation.json`,JSON.stringify({recipes:original.recipes.length,variants:inventory.length,newSourceChecks:definitions.length,corrections:corrections.length,knownContainsRelations:relations.length,ambiguousIngredients:unresolvedComponents.length,globalCompletenessChanged:false,nutritionInferred:false,sourceSnapshots:definitions.map(d=>({id:d.sourceRecord,sha256:d.sourceSha256})),dataHash:compositionHash(data)},null,2),{flag:'wx'});
  console.log(JSON.stringify({prepared:true,sourceChecks:definitions.length,corrections:corrections.length,relations:relations.length,ambiguousIngredients:unresolvedComponents.length,globalCompletenessChanged:false}));
}
main().catch(error=>{console.error('COMPOSITION_V2_PREPARE_FAILED',error.message);process.exitCode=1;});
