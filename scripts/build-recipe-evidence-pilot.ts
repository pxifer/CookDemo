import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { evidenceHash,recipeMethod,type RecipeEvidenceBinding } from '../backend/src/recipe-evidence';
import type { ContentSnapshot } from '../shared/content';
import type { KnowledgeBundle } from '../shared/health-knowledge';
// Public release only. This file contains no account configuration or secret.
const source=process.argv[2]??'.local-data/cloudbase-http/listed-foods-20261026-v28-final/gallery-bundle.json';
const raw=await readFile(source),original:ContentSnapshot=JSON.parse(raw.toString()).listedFoodSnapshot;
if(original.contentVersion!=='gallery-listed-foods-20261026-v28'||original.restrictionScope!=='listed-foods')throw Error('PILOT_RELEASE_MISMATCH');
const recipes=original.recipes.filter(r=>['白菜豆腐汤','麻婆豆腐'].includes(r.name));
if(recipes.length!==2)throw Error('PILOT_RECIPES_MISSING');
const ids=new Set(recipes.flatMap(r=>r.variants.flatMap(v=>v.lines.map(l=>l.foodId))));
const content:ContentSnapshot={contentVersion:original.contentVersion,contentState:original.contentState,restrictionScope:'listed-foods',recipes,foods:original.foods.filter(f=>ids.has(f.id)),categories:[],relations:[]};
const kb:KnowledgeBundle=JSON.parse(await readFile('datasets/health/2026-10-28-v2/knowledge-bundle.json','utf8'));
const mapping=[{foodId:'tofu',entityId:'f:tofu',factId:'fact:ht-prefer-tofu',basis:'明列豆腐食品ID，关联豆腐食物级指南；不扩展至内酯豆腐或豆制品类别。'},
  {foodId:'salt',entityId:'f:salt',factId:'fact:ht-limit-salt',basis:'明列盐食品ID与食盐食物级指南关联，不换算每餐剂量。'},
  {foodId:'soy',entityId:'f:soy-sauce',factId:'fact:ht-limit-soy-sauce',basis:'明列生抽/原文酱油与酱油食物级指南关联，不假设钠含量。'}];
const bindings:RecipeEvidenceBinding[]=recipes.flatMap(recipe=>recipe.variants.flatMap(variant=>mapping.filter(m=>variant.lines.some(l=>l.foodId===m.foodId)).map(m=>{
  const fact=kb.facts.find(f=>f.id===m.factId)!;
  const method:RecipeEvidenceBinding['method']={kind:'primary',index:0,hash:''};method.hash=evidenceHash(recipeMethod(variant,method));
  return {id:`pilot:${variant.id}:${m.foodId}`,bundleId:kb.id,contentVersion:content.contentVersion,recipeId:recipe.id,variantId:variant.id,variantHash:evidenceHash({recipeVersion:recipe.version,variant}),foodId:m.foodId,entityId:m.entityId,factId:fact.id,factVersion:fact.version,factHash:evidenceHash(fact),method,scope:'listed_ingredient_only' as const,mappingBasis:m.basis};
})));
const out='datasets/health/recipe-research';await mkdir(out,{recursive:true});
await writeFile(`${out}/recipe-snapshot.json`,JSON.stringify(content,null,2)+'\n');
await writeFile(`${out}/bindings.json`,JSON.stringify(bindings,null,2)+'\n');
await writeFile(`${out}/manifest.json`,JSON.stringify({status:'research_pilot',onlineEnabled:false,clinicalRelease:null,sourceContentVersion:content.contentVersion,sourcePublicBundleSha256:createHash('sha256').update(raw).digest('hex'),contentHash:evidenceHash(content),bindingsHash:evidenceHash(bindings),recipes:recipes.length,bindings:bindings.length,unboundIngredients:'unknown, not safe',scope:'ingredient-level annotations; no whole-recipe recommendation or new cooking-effect inference'},null,2)+'\n');
console.log(JSON.stringify({recipes:recipes.length,bindings:bindings.length,onlineEnabled:false}));
