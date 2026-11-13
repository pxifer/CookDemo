import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import schema from '../../../datasets/health/nutrition-expansion-v1.schema.json';
import catalog from '../../../datasets/health/catalog.json';
import type { NutritionExpansion, NutritionRule, CompositionFood } from '../../../shared/nutrition-knowledge';
import { canonicalKnowledgeHash, sha256 } from '../health-knowledge';

export const nutritionExpansionVersion=catalog.defaultNutritionExpansion;
const validator=new Ajv({allErrors:true,strict:false}).compile<NutritionExpansion>(schema);
const invalid=():never=>{throw Error('NUTRITION_KNOWLEDGE_INVALID');};
const unique=<T extends {id:string}>(rows:T[])=>{const result=new Map(rows.map(r=>[r.id,r]));if(result.size!==rows.length)invalid();return result;};
export function validateNutritionExpansion(raw:unknown):NutritionExpansion {
  if(!validator(raw))invalid();
  const bundle=raw as NutritionExpansion;
  const sources=unique(bundle.sources),evidence=unique(bundle.evidence),topics=unique(bundle.topics),objects=unique(bundle.objects),foods=unique(bundle.foods),nutrients=unique(bundle.nutrients);
  unique(bundle.facts);unique(bundle.principles);unique(bundle.values);
  for(const e of evidence.values()){
    const s=sources.get(e.sourceId),loc=e.locator as {start:number;end:number;kind:string};
    if(!s||e.version!==s.version||e.sourceHash!==s.sourceHash||e.url!==s.url||e.title!==s.title||sha256(e.originalSpan)!==e.spanHash||loc.end-loc.start!==e.originalSpan.length||loc.kind!==s.acquisition)invalid();
  }
  for(const r of [...bundle.facts,...bundle.principles]){
    if(!topics.has(r.topicId)||new Set(r.conditions.map(c=>c.key)).size!==r.conditions.length||new Set([...r.evidenceIds,...r.qualifyingEvidenceIds]).size!==r.evidenceIds.length+r.qualifyingEvidenceIds.length||[...r.evidenceIds,...r.qualifyingEvidenceIds].some(id=>!evidence.has(id)))invalid();
    if('objectId' in r&&!objects.has(r.objectId))invalid();
    if('metricIds' in r&&r.metricIds.some(id=>!nutrients.has(id)))invalid();
  }
  for(const f of foods.values())if(!sources.has(f.sourceId)||f.id!==`usda:${f.fdcId}`||sources.get(f.sourceId)?.acquisition!=='official_csv_archive')invalid();
  const cells=new Set<string>();
  for(const v of bundle.values){
    const f=foods.get(v.foodId),n=nutrients.get(v.nutrientId),key=`${v.foodId}\0${v.nutrientId}`;
    if(!f||!n||n.unit!==v.unit||cells.has(key)||v.id!==`composition:${f.fdcId}:${n.id}`)invalid();
    cells.add(key);
    if(v.status==='not_reported'){
      if([v.value,v.amountText,v.sourceRow,v.csvRow,v.rowHash,v.derivation].some(x=>x!==null))invalid();
    }else{
      const row=v.sourceRow;
      if(v.value===null||v.amountText===null||!row||!v.rowHash||v.csvRow===null||Number(v.amountText)!==v.value||row.amount!==v.amountText||row.fdc_id!==f!.fdcId||row.nutrient_id!==n!.usdaId||!row.id)invalid();
      const rowHash=sha256(JSON.stringify(Object.fromEntries(Object.entries(row!).sort(([a],[b])=>a<b?-1:a>b?1:0))));
      if(v.rowHash!==rowHash||(v.derivation&&v.derivation.id!==row!.derivation_id))invalid();
    }
  }
  if(cells.size!==foods.size*nutrients.size)invalid();
  return bundle;
}
export async function readNutritionExpansion(){
  if(!/^nutrition-guidance-\d{4}-\d{2}-\d{2}-v\d+$/.test(nutritionExpansionVersion)||!catalog.nutritionExpansionVersions.includes(nutritionExpansionVersion))throw Error('NUTRITION_VERSION_INVALID');
  const base=new URL(`../../../datasets/health/${nutritionExpansionVersion}/`,import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
  if(!manifest.files||typeof manifest.files!=='object')throw Error('NUTRITION_MANIFEST_INVALID');
  for(const [name,hash] of Object.entries(manifest.files))if(!/^[\w.-]+$/.test(name)||sha256(await readFile(new URL(name,base)))!==hash)throw Error('NUTRITION_MANIFEST_INVALID');
  const bytes=await readFile(new URL('knowledge.json',base));
  if(manifest.id!==nutritionExpansionVersion||manifest.clinicalRelease!==null||manifest.files?.['knowledge.json']!==sha256(bytes))throw Error('NUTRITION_MANIFEST_INVALID');
  const bundle=validateNutritionExpansion(JSON.parse(bytes.toString('utf8')));
  for(const key of ['sources','evidence','topics','objects','facts','principles','foods','nutrients','values'] as const)if(manifest.counts?.[key]!==bundle[key].length)throw Error('NUTRITION_MANIFEST_INVALID');
  if(bundle.id!==manifest.id||manifest.counts.reportedValues!==bundle.values.filter(v=>v.value!==null).length||manifest.counts.missingValues!==bundle.values.filter(v=>v.value===null).length)throw Error('NUTRITION_MANIFEST_INVALID');
  const curation=await readFile(new URL('../../../datasets/health/nutrition-curation-v1.json',import.meta.url));
  const lock=await readFile(new URL('../../../datasets/health/nutrition-source-lock-v1.json',import.meta.url));
  if(sha256(curation)!==manifest.curationHash||sha256(lock)!==manifest.sourceLockHash)throw Error('NUTRITION_MANIFEST_INVALID');
  const hashes=JSON.parse(lock.toString('utf8')) as Record<string,string>;
  if(bundle.sources.some(s=>s.sourceHash!==hashes[s.id]))throw Error('NUTRITION_MANIFEST_INVALID');
  return {bundle,manifest};
}
export function nutritionEvidenceBlocked(bundle:NutritionExpansion,id:string,revoked:ReadonlySet<string>){
  const e=bundle.evidence.find(e=>e.id===id),s=e&&bundle.sources.find(s=>s.id===e.sourceId);
  return !e||!s||[bundle.id,e.id,s.id,`${s.id}@${s.version}`,s.sourceHash].some(x=>revoked.has(x));
}
export function nutritionApplicability(bundle:NutritionExpansion,row:NutritionRule,conditions:Record<string,string|undefined>,revoked:ReadonlySet<string>){
  if([bundle.id,row.id,row.topicId,...('objectId' in row?[String(row.objectId)]:[])].some(x=>revoked.has(x))||[...row.evidenceIds,...row.qualifyingEvidenceIds].some(id=>nutritionEvidenceBlocked(bundle,id,revoked)))return 'withdrawn' as const;
  if(row.conditions.some(c=>conditions[c.key]&&conditions[c.key]!=='unknown'&&!c.values.includes(conditions[c.key]!)))return 'not_applicable' as const;
  return row.conditions.some(c=>!conditions[c.key]||conditions[c.key]==='unknown')?'needs_confirmation' as const:'applicable' as const;
}
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s/g,'');
/** Literal lexicon matching. Longest overlapping names win: B12 must never retrieve B1. */
function spans(query:string,terms:string[]){
  return terms.flatMap(term=>{const name=norm(term),result:{start:number;end:number}[]=[];let at=query.indexOf(name);
    while(at>=0){const end=at+name.length;if(!(/[a-z0-9]$/.test(name)&&/[a-z0-9]/.test(query[end]??'')))result.push({start:at,end});at=query.indexOf(name,at+1);}
    return result;
  });
}
function matches(query:string,terms:string[]){return spans(query,terms).length>0;}
export function searchNutritionKnowledge(bundle:NutritionExpansion,query:string,options:{limit?:number;conditions?:Record<string,string>;revoked?:ReadonlySet<string>}={}){
  if(!query.trim()||query.length>1000)throw Error('NUTRITION_QUERY_INVALID');
  const q=norm(query),limit=Math.max(1,Math.min(50,Math.floor(options.limit??10))),revoked=options.revoked??new Set<string>(),conditions=options.conditions??{};
  if(!Number.isFinite(limit))throw Error('NUTRITION_QUERY_INVALID');
  const blocked=(ids:string[])=>revoked.has(bundle.id)||ids.some(id=>revoked.has(id));
  const topics=bundle.topics.filter(t=>matches(q,[t.name,...t.aliases,t.id]));
  const facts=bundle.facts.filter(f=>topics.some(t=>t.id===f.topicId)).map(f=>({...f,object:bundle.objects.find(o=>o.id===f.objectId)!,applicability:nutritionApplicability(bundle,f,conditions,revoked)}));
  const principles=bundle.principles.filter(p=>topics.some(t=>t.id===p.topicId)).map(p=>({...p,applicability:nutritionApplicability(bundle,p,conditions,revoked)}));
  const nutrientSpans=bundle.nutrients.flatMap(n=>spans(q,[n.id,n.name,...n.aliases]).map(span=>({...span,nutrientId:n.id})));
  const matchedNutrients=new Set(nutrientSpans.filter(s=>!nutrientSpans.some(long=>long.start<=s.start&&long.end>=s.end&&long.end-long.start>s.end-s.start)).map(s=>s.nutrientId));
  let nutrients=bundle.nutrients.filter(n=>matchedNutrients.has(n.id));
  if(!nutrients.length&&/维生素b(?!\d)|b族|维b(?!\d)/i.test(q))nutrients=bundle.nutrients.filter(n=>n.id.startsWith('vitamin-b')||n.id.startsWith('folate-')||n.id==='biotin');
  const foodSpans=bundle.foods.flatMap(f=>spans(q,[f.name,...f.aliases,f.id]).map(span=>({...span,foodId:f.id})));
  const matchedFoodIds=new Set(foodSpans.map(s=>s.foodId));
  // Suppress only contained text spans, preserving separately named fresh AND dried comparisons.
  const explicitFoods=bundle.foods.filter(f=>matchedFoodIds.has(f.id));
  const selectedIds=new Set(foodSpans.filter(s=>!foodSpans.some(long=>long.start<=s.start&&long.end>=s.end&&long.end-long.start>s.end-s.start)).map(s=>s.foodId));
  const selected=explicitFoods.filter(f=>selectedIds.has(f.id));
  const objectNames=facts.filter(f=>f.applicability!=='withdrawn'&&f.applicability!=='not_applicable').flatMap(f=>f.object.names);
  let foods:CompositionFood[]=selected.length?selected:explicitFoods.length?[]:topics.length?bundle.foods.filter(f=>[f.name,...f.aliases].some(a=>objectNames.includes(a))):nutrients.length?bundle.foods:[];
  if(!nutrients.length&&topics.length){const ids=new Set(principles.filter(p=>p.applicability!=='withdrawn'&&p.applicability!=='not_applicable').flatMap(p=>p.metricIds));nutrients=bundle.nutrients.filter(n=>ids.has(n.id));}
  const liveFood=(f:CompositionFood)=>{const s=bundle.sources.find(s=>s.id===f.sourceId)!;return !blocked([f.id,s.id,`${s.id}@${s.version}`,s.sourceHash]);};
  foods=foods.filter(liveFood);
  const rows=(food:CompositionFood)=>bundle.values.filter(v=>v.foodId===food.id&&(!nutrients.length||nutrients.some(n=>n.id===v.nutrientId))&&!blocked([v.id,v.nutrientId]));
  if(nutrients.length===1&&!explicitFoods.length&&!topics.length)foods.sort((a,b)=>(rows(b)[0]?.value??-1)-(rows(a)[0]?.value??-1)||a.id.localeCompare(b.id));
  const foodResults=foods.filter(f=>rows(f).length).slice(0,limit).map(food=>({food,foodFormConfirmed:false,values:rows(food),usage:'reference_composition_only_not_recipe_or_personal_intake' as const}));
  const ids=new Set([...facts,...principles].filter(f=>f.applicability!=='withdrawn').flatMap(f=>[...f.evidenceIds,...f.qualifyingEvidenceIds]));
  return {mode:'local_research' as const,clinicalRelease:null,knowledgeVersion:bundle.id,fingerprint:canonicalKnowledgeHash({bundle,revoked:[...revoked].sort()}),lookupScope:explicitFoods.length?'matched_food_references':topics.length?'topic_related_food_references':nutrients.length?'nutrient_reference_ranking':'unmatched',topics,facts,principles,nutrients,foods:foodResults,evidence:bundle.evidence.filter(e=>ids.has(e.id)&&!nutritionEvidenceBlocked(bundle,e.id,revoked)),sources:bundle.sources.filter(s=>!blocked([s.id,`${s.id}@${s.version}`,s.sourceHash])),interpretation:'每100克可食部、具体形态的美国历史参考组成；缺失不等于零，零值也不等于绝对不含。食材名称仅用于召回，未确认具体形态；未匹配食材时只提供指标参考列表，不计算整菜或个人目标。'};
}
