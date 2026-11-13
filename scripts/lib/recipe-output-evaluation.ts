import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {contentContext,type ContentSnapshot,type ContentContext} from '../../shared/content';
import {defaultMeal,type Meal,type RecommendationResult} from '../../shared/types';
import type {HealthContext} from '../../shared/health-chat';
import type {FoodGuidancePacket} from '../../shared/food-guidance';
import {extractText} from '../../shared/extraction';
import {findPantryIngredient} from '../../shared/ingredient-matching';
import {isCookingWater} from '../../shared/pantry';
import {inputIngredient,mergeInput} from '../../frontend/src/meal-input';
import type {HealthInputUnderstanding} from '../../backend/src/health-input-understanding';
import type {HealthChatReply,ChatMessage} from '../../shared/health-chat';
import {outputCampaignDirectory} from './output-evaluation-budget';
import {verifyGalleryBundle} from '../../backend/src/cloudbase-content';

export interface OutputCase {id:string;title:string;task:'meal'|'food_guidance'|'open_input';family:string;split:'development'|'regression';input:{profile:HealthContext;userText?:string;history?:ChatMessage[];parentRunId?:string;conditions?:Record<string,string>;ingredients?:string;servings?:number;allowBuy?:boolean;allergies?:string[];avoids?:string[];onlyRecipe?:string;counts?:Record<'meat'|'veg'|'soup',number>}}
export interface OutputLabel {status?:string;factId?:string;direction?:string;applicability?:string;noDiseaseTopic?:boolean;uncoveredTopic?:string;noModelCall?:boolean;equivalentTo?:string;intents?:string[];conditions?:string[];goals?:string[];subject?:string;noDisease?:boolean;forbiddenGoals?:string[];forbiddenConditions?:string[];mealStatus?:string;humanExpectation?:string}
export const outputHash=(value:unknown)=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const forbiddenInputKey=(x:unknown):boolean=>Boolean(x&&typeof x==='object'&&Object.entries(x).some(([k,v])=>/^(gold|expected|labels?|review|answerKey|allowedRecipes|forbiddenRecipes)$/i.test(k)||forbiddenInputKey(v)));
export async function readOutputDataset(){
 const raw=await readFile('datasets/evaluation/recipe-output-v1.inputs.json','utf8');
 const dataset=JSON.parse(raw) as {id:string;cases:OutputCase[]};
 if(dataset.id!=='recipe-output-v1'||dataset.cases.length!==24||new Set(dataset.cases.map(c=>c.id)).size!==24||dataset.cases.some(c=>!c.input||forbiddenInputKey(c.input)))throw Error('OUTPUT_DATASET_INVALID_OR_LABEL_LEAK');
 const openRaw=await readFile('datasets/evaluation/open-input-v1.inputs.json','utf8'),open=JSON.parse(openRaw);
 const directory=join(outputCampaignDirectory,'custom-cases'),names=await readdir(directory).catch(e=>{if(e.code==='ENOENT')return [] as string[];throw e;});
 const custom=await Promise.all(names.filter(n=>/^custom-[\w-]+\.input\.json$/.test(n)).sort().map(n=>readFile(join(directory,n),'utf8').then(JSON.parse)));
 const cases:OutputCase[]=[...dataset.cases,...open.cases,...custom];
 if(open.id!=='open-input-v1'||open.cases.length!==24||new Set(cases.map(c=>c.id)).size!==cases.length||cases.some(c=>forbiddenInputKey(c.input)))throw Error('OPEN_DATASET_INVALID');
 return {...dataset,cases,sha256:outputHash({base:raw,open:openRaw,custom}),baseDataset:'recipe-output-v1',openDataset:'open-input-v1'};
}
/** Only this copy goes to inference. Labels are loaded by the scorer after inference. */
export function outputInferenceInput(item:OutputCase){if(forbiddenInputKey(item.input))throw Error('OUTPUT_INPUT_LABEL_LEAK');return structuredClone(item.input);}
export async function readOutputLabels(){
 const raw=await readFile('datasets/evaluation/recipe-output-v1.labels.json','utf8'),openRaw=await readFile('datasets/evaluation/open-input-v1.labels.json','utf8');const base=JSON.parse(raw),open=JSON.parse(openRaw);
 if(base.inputDataset!=='recipe-output-v1'||base.independent!==false||open.independent!==false)throw Error('OUTPUT_LABELS_INVALID');
 const directory=join(outputCampaignDirectory,'custom-cases'),names=await readdir(directory).catch(e=>{if(e.code==='ENOENT')return [] as string[];throw e;});
 const custom=await Promise.all(names.filter(n=>/^custom-[\w-]+\.label\.json$/.test(n)).sort().map(n=>readFile(join(directory,n),'utf8').then(JSON.parse)));
 return {labels:{...base.labels,...open.labels,...Object.fromEntries(custom.map(c=>[c.id,{humanExpectation:c.humanExpectation}]))} as Record<string,OutputLabel>,sha256:outputHash({raw,openRaw,custom})};
}
export async function readEvaluationContent(){
 const dir='.local-data/cloudbase-http/listed-foods-20261026-v28/';
 const manifest=JSON.parse(await readFile(dir+'manifest.json','utf8')),raw=await readFile(dir+'gallery-bundle.json','utf8');
 const snapshot=verifyGalleryBundle(JSON.parse(raw),manifest.hash);
 return {snapshot,content:contentContext(snapshot),sha256:outputHash(raw)};
}
export function outputMeal(item:OutputCase,snapshot:ContentSnapshot){
 const input=outputInferenceInput(item),view=input.onlyRecipe?{...snapshot,recipes:snapshot.recipes.filter(r=>r.name===input.onlyRecipe)}:snapshot;
 if(input.onlyRecipe&&!view.recipes.length)throw Error('OUTPUT_REQUIRED_RECIPE_NOT_IN_SNAPSHOT');
 const content=contentContext(view);
 // The case field is a pantry-name list, not unrestricted prose. Retain an unknown
 // complete name instead of accepting a known substring; share the UI's resolver.
 const ingredients=(input.ingredients??'').split(/[、,，;；\n]/).map(s=>s.trim()).filter(Boolean).flatMap(name=>{
  const parsed=extractText(name,content);
  return parsed.unresolved.length||parsed.restrictions.length||parsed.diseases.length?[inputIngredient(name,content)]:parsed.ingredients;
 });
 const meal:Meal={...defaultMeal(),raw:input.ingredients??'',health:true,composition:input.counts?'custom':'auto',counts:input.counts??defaultMeal().counts,servings:input.servings??1,allowBuy:Boolean(input.allowBuy),ingredients:mergeInput([],ingredients),healthProfile:{...input.profile,suggestions:[],updatedAt:'2026-11-13'}};
 meal.restrictions=[...(input.allergies??[]).map(name=>({name,kind:'allergy' as const})),...(input.avoids??[]).map(name=>({name,kind:'avoid' as const}))].map(({name,kind},i)=>{const targets=content.restrictionTargets(name);return {id:'constructed-restriction-'+i,name,kind,scope:'self' as const,targets,status:targets.length?'confirmed' as const:'unknown' as const,original:'评测明确限制'};});
 return {meal,content};
}
export interface EngineeringCheck {id:string;passed:boolean|null;points:number;detail:string}
export function scoreOutput(item:OutputCase,label:OutputLabel,observed:{result?:RecommendationResult;packet?:FoodGuidancePacket;attempts:number;error?:string;understanding?:HealthInputUnderstanding;reply?:HealthChatReply;unmetNeeds?:string[]},context?:{meal:Meal;content:ContentContext}){
 const checks:EngineeringCheck[]=[],hardFailures:string[]=[];
 const add=(id:string,passed:boolean|null,points:number,detail='')=>checks.push({id,passed,points,detail});
 if(item.task==='food_guidance'){
  const packet=observed.packet,g=packet?.guidance.find(g=>g.factId===label.factId);
  add('expected_fact',label.factId?Boolean(g):Boolean(packet),40);
  add('direction_and_applicability',Boolean(packet)&&(!label.direction||g?.direction===label.direction)&&(!label.applicability||g?.applicability===label.applicability),40);
  add('topic_boundaries',Boolean(packet)&&(!label.noDiseaseTopic||!packet!.topics.some(t=>t.kind==='condition'))&&(!label.uncoveredTopic||packet!.uncoveredTopics.includes(label.uncoveredTopic)),20);
  if(packet){const ids=new Set(packet.evidence.map(e=>e.id));for(const fact of packet.guidance.filter(g=>g.applicability==='applicable'))if([...fact.evidenceIds,...fact.qualifyingEvidenceIds].some(id=>!ids.has(id)))hardFailures.push('missing_support_or_qualifier');}
 }else if(item.task==='open_input'){
  const u=observed.understanding,profile=u??observed.reply?.assessment?.profile;
  add('intent',label.intents&&u?label.intents.includes(u.intent):null,25,'无独立意图输出时不填满分；人工核对最终回复是否回应需求');
  add('explicit_conditions',label.conditions&&profile?label.conditions.every(n=>profile.conditions.includes(n)):label.noDisease&&profile?profile.conditions.length===0:null,25);
  add('explicit_goals',profile&&(label.goals||label.forbiddenGoals)?(!label.goals||label.goals.every(n=>profile.goals.includes(n)))&&(!label.forbiddenGoals||label.forbiddenGoals.every(n=>!profile.goals.includes(n))):null,20);
  add('subject_and_negative_conditions',u&&(label.subject||label.forbiddenConditions)?(!label.subject||u.subject===label.subject)&&(!label.forbiddenConditions||label.forbiddenConditions.every(n=>!u.conditions.includes(n))):null,15);
  add('usable_terminal_reply',Boolean(observed.reply?.message.content||observed.result)&&!observed.error,15);
  if(label.mealStatus)add('meal_terminal',observed.result?.status===label.mealStatus,25);
  if(observed.result&&context){const footprint=scoreOutput({...item,task:'meal'},{...label,status:label.mealStatus},observed,context);hardFailures.push(...footprint.hardFailures);}
  if(u?.intent==='off_topic'&&(u.conditions.length||u.goals.length))hardFailures.push('offtopic_polluted_health_topics');
  if(u?.intent==='medical_request'&&observed.result?.status==='completed')hardFailures.push('medical_request_bypassed_boundary');
 }else{
  const result=observed.result,dishes=result?.dishes??[],ctx=context;
  add('expected_terminal_state',result?.status===label.status,40,observed.error??'');
  if(ctx&&result){
   const {meal,content}=ctx;
   const unique=new Set<string>();
   for(const d of dishes){
    const recipe=content.recipes.find(r=>r.id===d.recipe.id),variant=recipe?.variants.find(v=>v.id===d.variant.id);
    if(!recipe||!variant||unique.has(d.recipe.id))hardFailures.push('non_catalog_or_duplicate_parent');
    unique.add(d.recipe.id);
    if(variant&&outputHash(variant)!==outputHash(d.variant))hardFailures.push('recipe_variant_mutated');
    for(const line of d.variant.lines){
     const food=content.foodById.get(line.foodId);if(!food){hardFailures.push('invented_ingredient');continue;}
     // Omitted optional ingredients cannot create a false allergy or missing-stock failure.
     if(line.optional&&d.omitted.includes(food.name))continue;
     if(meal.restrictions.some(r=>r.targets.includes(line.foodId)))hardFailures.push('allergy_or_avoid_violated');
     if(!meal.allowBuy&&line.role!=='seasoning'&&!isCookingWater(food.name)&&!findPantryIngredient(line,meal.ingredients,content.foodById))hardFailures.push('unauthorized_missing_ingredient');
    }
    if(d.aiGrounding&&(d.aiGrounding.recipeId!==d.recipe.id||d.aiGrounding.variantId!==d.variant.id))hardFailures.push('grounding_bound_to_other_recipe');
    if(d.aiGrounding){
     const packet=observed.packet;
     if(!packet||d.aiGrounding.guidanceFingerprint!==packet.fingerprint)hardFailures.push('grounding_context_missing_or_stale');
     for(const match of d.aiGrounding.matches){
      const guidance=packet?.guidance.find(g=>g.id===match.guidanceId),evidenceIds=new Set(packet?.evidence.map(e=>e.id));
      if(!guidance||guidance.applicability!=='applicable'||[...guidance.evidenceIds,...guidance.qualifyingEvidenceIds].some(id=>!evidenceIds.has(id)))hardFailures.push('invented_inapplicable_or_incomplete_guidance');
      if(match.processRule){if(match.processRule!==guidance?.mapping.processRule||d.aiGrounding.methodId!=='primary'||d.aiGrounding.methodHash!==outputHash(d.variant.steps))hardFailures.push('process_grounding_mismatch');}
      else if(!match.foodIds.length||match.foodIds.some(id=>!guidance?.mapping.foodIds.includes(id)||!d.variant.lines.some(l=>l.foodId===id)))hardFailures.push('guidance_not_bound_to_ingredient');
     }
    }
   }
   add('catalog_and_variant_integrity',!hardFailures.some(f=>/catalog|ingredient|mutated/.test(f)),20);
   add('allergy_and_stock_rules',!hardFailures.some(f=>/violated|unauthorized/.test(f)),20);
   const actualCounts=Object.fromEntries(['meat','veg','soup'].map(c=>[c,dishes.filter(d=>d.recipe.category===c).length]));
   const correctCounts=result.status==='completed'?meal.composition==='auto'||Object.entries(meal.counts).every(([c,n])=>actualCounts[c]===n):label.status===result.status;
   add('requested_counts',correctCounts,20);
   if(result.status==='completed'&&!correctCounts)hardFailures.push('dish_count_or_category_mismatch');
   if(label.uncoveredTopic&&result.researchGuidance&&!result.researchGuidance.uncoveredTopics.includes(label.uncoveredTopic))hardFailures.push('uncovered_topic_not_retained');
  }else add('output_integrity',false,60,'未获得可核验的程序输出');
  if(label.noModelCall&&observed.attempts)hardFailures.push('avoidable_model_call_before_input_gate');
 }
 const scored=checks.filter(c=>c.passed!==null),denominator=scored.reduce((n,c)=>n+c.points,0);
 return {checks,hardFailures:[...new Set(hardFailures)],engineeringScore:denominator?Math.round(scored.reduce((n,c)=>n+(c.passed?c.points:0),0)/denominator*100):null,scoreDenominator:denominator,functionalPass:!hardFailures.length&&checks.every(c=>c.passed!==false),humanScore:null,effectivePass:null,clinicalReview:'pending',scope:'工程一致性，不是医学有效率；原因是否被原文支持待人工核对'};
}
export const humanDimensions=['goalFit','reasonSupport','conditionsAndUnknowns','actionability','clarity'] as const;
export function validateHumanReview(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('OUTPUT_HUMAN_REVIEW_INVALID');
 const r=raw as Record<string,unknown>;
 if(Object.keys(r).some(k=>!['reviewer','role','scores','criticalFailures','comment'].includes(k))||typeof r.reviewer!=='string'||!r.reviewer.trim()||r.reviewer.length>80||!['user_product_review','nutrition_medical'].includes(String(r.role))||!r.scores||typeof r.scores!=='object'||Array.isArray(r.scores)||Object.keys(r.scores).length!==5||humanDimensions.some(k=>!Number.isInteger((r.scores as any)[k])||(r.scores as any)[k]<0||(r.scores as any)[k]>4)||!Array.isArray(r.criticalFailures)||r.criticalFailures.some(x=>typeof x!=='string'||x.length>160)||r.criticalFailures.length>10||typeof r.comment!=='string'||!r.comment.trim()||r.comment.length>2000)throw Error('OUTPUT_HUMAN_REVIEW_INVALID');
 const score=Math.round(humanDimensions.reduce((n,k)=>n+(r.scores as any)[k],0)/20*100);
 return {...r,scores:r.scores as Record<typeof humanDimensions[number],number>,criticalFailures:r.criticalFailures as string[],score,independent:false,professionalIdentityVerified:false,recordedAt:new Date().toISOString(),note:'用户产品评分不自动等于独立/专业签认'};
}
