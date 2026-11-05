import type { ContentSnapshot } from '../../shared/content';
import type { KnowledgeBundle } from '../../shared/health-knowledge';
import { canonicalKnowledgeHash, factAvailability } from './health-knowledge';

export interface RecipeEvidenceBinding {
  id:string;bundleId:string;contentVersion:string;recipeId:string;variantId:string;
  variantHash:string;foodId:string;entityId:string;factId:string;factVersion:string;factHash:string;
  method:{kind:'primary'|'alternative';index:number;hash:string};
  scope:'listed_ingredient_only';mappingBasis:string;
}
export type EvidenceTaskState='research_annotations'|'needs_confirmation'|'not_applicable'|'withdrawn'|'stale_binding'|'insufficient_evidence'|'budget_exhausted'|'cancelled';
export interface EvidenceTaskResult {
  state:EvidenceTaskState;executionAllowed:false;clinicalRelease:null;
  trace:{tool:'inspect_variant'|'retrieve_bound_facts'|'revalidate';status:string}[];
  annotations:{bindingId:string;factId:string;foodId:string;action:string;statement:string;conditions:unknown;recipeSource:unknown;ingredientSource:unknown;method:unknown;citations:unknown[];conflicts:unknown[]}[];
  missingConditions:string[];uncoveredFoodIds:string[];
}
export const evidenceHash=canonicalKnowledgeHash;
export function recipeMethod(variant:ContentSnapshot['recipes'][number]['variants'][number],method:RecipeEvidenceBinding['method']){
  return method.kind==='primary'?{label:variant.methodLabel??'',steps:variant.steps}:variant.methodOptions?.[method.index];
}

/** Bounded research workflow, deliberately not a claim of autonomous LLM agency.
 * It inspects exact recipe versions, retrieves food-level evidence, branches on
 * conditions, then rereads revocations and content before returning annotations.
 * It never writes preferences, approves a dish, or calls a provider.
 */
export async function runRecipeEvidenceTask(input:{
  bindings:RecipeEvidenceBinding[];recipeId:string;variantId:string;context:Record<string,string|undefined>;
  load:()=>Promise<{content:ContentSnapshot;knowledge:KnowledgeBundle;revoked:ReadonlySet<string>}>;
  signal?:AbortSignal;maxToolCalls?:number;
}):Promise<EvidenceTaskResult>{
  const result:EvidenceTaskResult={state:'insufficient_evidence',executionAllowed:false,clinicalRelease:null,trace:[],annotations:[],missingConditions:[],uncoveredFoodIds:[]};
  const budget=Math.min(3,Math.max(0,input.maxToolCalls??3));
  const stop=(state:EvidenceTaskState)=>({...result,state,annotations:[]});
  const call=(tool:EvidenceTaskResult['trace'][number]['tool'])=>{
    if(input.signal?.aborted)return false;
    if(result.trace.length>=budget)return false;
    result.trace.push({tool,status:'completed'});return true;
  };
  const exhausted=()=>input.signal?.aborted?'cancelled' as const:'budget_exhausted' as const;
  if(!call('inspect_variant'))return stop(exhausted());
  const first=await input.load();
  const recipe=first.content.recipes.find(r=>r.id===input.recipeId),variant=recipe?.variants.find(v=>v.id===input.variantId);
  if(!recipe||recipe.state!=='published'||!variant)return stop('stale_binding');
  const bindings=input.bindings.filter(b=>b.recipeId===recipe.id&&b.variantId===variant.id);
  result.uncoveredFoodIds=[...new Set(variant.lines.map(l=>l.foodId))].filter(id=>!bindings.some(b=>b.foodId===id));
  if(!bindings.length)return stop('insufficient_evidence');
  if(!call('retrieve_bound_facts'))return stop(exhausted());
  const missing=new Set<string>();let inapplicable=false;
  for(const b of bindings){
    const fact=first.knowledge.facts.find(f=>f.id===b.factId);
    const food=first.content.foods.find(f=>f.id===b.foodId);
    const method=recipeMethod(variant,b.method);
    if(b.scope!=='listed_ingredient_only'||!b.mappingBasis||!food||!variant.lines.some(l=>l.foodId===b.foodId)
      ||b.bundleId!==first.knowledge.id||b.contentVersion!==first.content.contentVersion||b.variantHash!==evidenceHash({recipeVersion:recipe.version,variant})
      ||!method||b.method.kind==='primary'&&b.method.index!==0||evidenceHash(method)!==b.method.hash||!fact||fact.kind!=='food_guidance'||fact.objectId!==b.entityId||fact.version!==b.factVersion||evidenceHash(fact)!==b.factHash)return stop('stale_binding');
    const state=factAvailability(first.knowledge,fact,input.context,first.revoked);
    if(state==='withdrawn')return stop('withdrawn');
    if(state==='evidence_missing')return stop('insufficient_evidence');
    if(state==='needs_confirmation')for(const c of fact.conditions)if(!input.context[c.key]||input.context[c.key]==='unknown')missing.add(c.key);
    if(state==='not_applicable'){inapplicable=true;continue;}
    const ids=[...new Set([...fact.evidenceIds,...fact.qualifyingEvidenceIds])];
    result.annotations.push({bindingId:b.id,factId:fact.id,foodId:b.foodId,action:fact.predicate,statement:fact.statement,conditions:fact.conditions,
      recipeSource:{recipeId:recipe.id,variantId:variant.id,recipeVersion:recipe.version,uri:recipe.source.uri,recordId:recipe.source.recordId},
      ingredientSource:variant.lines.map((line,index)=>({line,index})).filter(({line})=>line.foodId===b.foodId).map(({line,index})=>({lineIndex:index,sourceText:line.sourceText,form:line.form})),method:{...b.method,label:method.label},
      citations:ids.map(id=>{const e=first.knowledge.evidence.find(e=>e.id===id)!,s=first.knowledge.sources.find(s=>s.id===e.sourceId)!;return {evidenceId:id,sourceId:s.id,version:s.version,url:s.url,title:s.title,locator:e.locator,sourceHash:e.sourceHash,spanHash:e.spanHash};}),
      conflicts:first.knowledge.conflicts.filter(c=>c.factIds?.includes(fact.id)||c.evidenceIds?.some(id=>ids.includes(id)))});
  }
  result.missingConditions=[...missing].sort();
  if(!call('revalidate'))return stop(exhausted());
  const latest=await input.load();
  if(input.signal?.aborted)return stop('cancelled');
  // A change under the same version is also stale. No cached recommendation or
  // positive score can override deletion or an adverse/conditional annotation.
  if(evidenceHash(latest.content)!==evidenceHash(first.content)||evidenceHash(latest.knowledge)!==evidenceHash(first.knowledge))return stop('stale_binding');
  if(bindings.some(b=>{const f=latest.knowledge.facts.find(f=>f.id===b.factId)!;return factAvailability(latest.knowledge,f,input.context,latest.revoked)==='withdrawn';}))return stop('withdrawn');
  if(missing.size)return stop('needs_confirmation');
  if(inapplicable)return stop('not_applicable');
  result.state='research_annotations';return result;
}
