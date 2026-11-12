import type { KnowledgeBundle, KnowledgeEntity, KnowledgeFact } from '../../shared/health-knowledge';
import { effectiveKnowledgeRevocations } from './health-knowledge-policy';

export interface KnowledgeSearchOptions {
  diseaseId?: string; limit?: number; context?: Record<string,string|undefined>; revoked?: ReadonlySet<string>;
  algorithm?: 'a0' | 'a1'; requiredEvidenceIds?: string[];
}
const normalize = (s: string) => s.normalize('NFKC').toLowerCase();
const cache = new WeakMap<KnowledgeBundle, ReturnType<typeof buildLookup>>();
function buildLookup(bundle: KnowledgeBundle) {
  return {
    entities:new Map(bundle.entities.map(e=>[e.id,e])), sources:new Map(bundle.sources.map(s=>[s.id,s])),
    evidence:new Map(bundle.evidence.map(e=>[e.id,e])), facts:new Map(bundle.facts.map(f=>[f.id,f])),
    aliases:bundle.entities.flatMap(e=>[...new Set([e.name,...e.aliases])].map(name=>({id:e.id,text:normalize(name)}))),
    factText:new Map(bundle.facts.map(f=>[f.id,normalize(f.statement+' '+bundle.entities.filter(e=>e.id===f.subjectId||e.id===f.objectId).map(e=>e.name).join(' '))])),
  };
}
export function knowledgeLookup(bundle: KnowledgeBundle) {
  let index=cache.get(bundle);if(!index){index=buildLookup(bundle);cache.set(bundle,index);}return index;
}
export function resolveKnowledgeQuery(bundle: KnowledgeBundle, query: string) {
  const normalized=normalize(query), index=knowledgeLookup(bundle);
  const occurrences:{start:number;end:number;text:string;ids:string[]}[]=[];
  const spans=new Map<string,{start:number;end:number;text:string;ids:string[]}>();
  for(const alias of index.aliases) {
    let start=normalized.indexOf(alias.text);
    while(start>=0) {
      const end=start+alias.text.length,key=`${start}:${end}`;
      const match=spans.get(key)??{start,end,text:alias.text,ids:[]};
      if(!match.ids.includes(alias.id))match.ids.push(alias.id);spans.set(key,match);
      start=normalized.indexOf(alias.text,start+Math.max(1,alias.text.length));
    }
  }
  for(const hit of [...spans.values()].sort((a,b)=>(b.end-b.start)-(a.end-a.start)||a.start-b.start)) {
    if(!occurrences.some(o=>hit.start<o.end&&hit.end>o.start))occurrences.push(hit);
  }
  occurrences.sort((a,b)=>a.start-b.start);
  const unresolved:{mention:string;candidateIds:string[];reason:string}[]=[];
  const matched:KnowledgeEntity[]=[];
  for(const hit of occurrences) {
    if(hit.ids.length>1){unresolved.push({mention:hit.text,candidateIds:hit.ids,reason:'alias_collision'});continue;}
    const entity=index.entities.get(hit.ids[0])!;
    if(!matched.some(e=>e.id===entity.id))matched.push(entity);
  }
  const ambiguities:[string,string[]][]=[
    ['糖尿病',['d:type2-diabetes']],['肾病',['d:ckd']],
    ['香菇',['f:shiitake-fresh','f:shiitake-dry']],
    ['骨质疏松',['d:primary-osteoporosis']],
  ];
  for(const [mention,ids] of ambiguities) {
    if(normalized.includes(mention)&&!matched.some(e=>ids.includes(e.id)))unresolved.push({mention,candidateIds:ids.filter(id=>index.entities.has(id)),reason:'type_or_form_required'});
  }
  const tokens=new Set<string>();
  for(const hit of occurrences)tokens.add(hit.text);
  // Chinese bigrams recover continuous sentences; phrases and negation remain in the analysis.
  const stop=new Set(['可以','能不','不能','什么','哪些','怎么','建议','请问','需要','一下','这个','一个','患者','能吃','吃吗','是否','的是','食物','食材','存在','在的','的食','不存']);
  for(const m of normalized.matchAll(/[\p{Script=Han}]{2,}|[a-z0-9]+/gu)) {
    const word=m[0];
    if(/^[a-z0-9]+$/.test(word)){tokens.add(word);continue;}
    for(let i=0;i<word.length-1;i++){const token=word.slice(i,i+2);if(!stop.has(token))tokens.add(token);}
  }
  return {normalized,matched,unresolved,tokens:[...tokens],
    mentions:occurrences.map(o=>({...o,negated:/(?:不吃|不喝|避免|没有|不是|未患|不推荐)$/.test(normalized.slice(Math.max(0,o.start-6),o.start))})),
    requestedAction:/不能|避免|禁食|不吃|不喝/.test(normalized)?'avoid_explanation':null};
}

export function searchKnowledgeA1(bundle:KnowledgeBundle,query:string,options:KnowledgeSearchOptions,
  availability:(bundle:KnowledgeBundle,fact:KnowledgeFact,context?:Record<string,string|undefined>,revoked?:ReadonlySet<string>)=>string) {
  if(!query.trim()||query.length>1000)throw new Error('HEALTH_QUERY_INVALID');
  const index=knowledgeLookup(bundle),analysis=resolveKnowledgeQuery(bundle,query);
  if(options.diseaseId&&index.entities.get(options.diseaseId)?.kind!=='disease')throw new Error('HEALTH_DISEASE_UNKNOWN');
  if(options.limit!==undefined&&(!Number.isInteger(options.limit)||options.limit<1||options.limit>50))throw new Error('HEALTH_QUERY_LIMIT_INVALID');
  const limit=options.limit??10;
  const required=[...new Set(options.requiredEvidenceIds??[])];
  if(required.length>100)throw new Error('HEALTH_REQUIRED_EVIDENCE_LIMIT');
  const unresolved=analysis.unresolved.filter(u=>{
    if(options.diseaseId&&u.candidateIds.includes(options.diseaseId))return false;
    if(u.mention==='糖尿病'&&options.context?.diabetesType==='type2')return false;
    if(u.mention==='骨质疏松'&&options.context?.osteoporosisType==='primary')return false;
    return true;
  });
  const diseaseIds=new Set(options.diseaseId?[options.diseaseId]:analysis.matched.filter(e=>e.kind==='disease').map(e=>e.id));
  const objectIds=new Set(analysis.matched.filter(e=>e.kind!=='disease').map(e=>e.id));
  const foodIds=new Set(analysis.matched.filter(e=>e.kind==='food'||e.kind==='food_group').map(e=>e.id));
  const componentIds=new Set(analysis.matched.filter(e=>e.kind==='component').map(e=>e.id));
  const processIds=new Set(analysis.matched.filter(e=>e.kind==='process').map(e=>e.id));
  const blocked=effectiveKnowledgeRevocations(bundle,options.revoked);
  const evidenceActive=(id:string)=>{
    const e=index.evidence.get(id),s=e&&index.sources.get(e.sourceId);
    return !!(e&&s&&e.status==='active'&&s.status==='active'&&!blocked.has(bundle.id)&&![id,s.id,`${s.id}@${s.version}`,s.sourceHash].some(x=>blocked.has(x)));
  };
  const candidates=bundle.facts.flatMap(f=>{
    const applicable=availability(bundle,f,options.context,options.revoked);
    if(['withdrawn','evidence_missing','not_applicable'].includes(applicable))return [];
    if(diseaseIds.size&&(f.kind==='disease_component'||f.kind==='food_guidance')&&!diseaseIds.has(f.subjectId))return [];
    if(foodIds.size&&f.kind==='food_component'&&!foodIds.has(f.subjectId))return [];
    if(foodIds.size&&f.kind==='food_guidance'&&!foodIds.has(f.objectId)&&!processIds.has(f.objectId))return [];
    if(processIds.size&&f.kind==='cooking_effect'&&!processIds.has(f.subjectId))return [];
    if(componentIds.size&&index.entities.get(f.objectId)?.kind==='component'&&!componentIds.has(f.objectId))return [];
    const entityMatches=[f.subjectId,f.objectId].filter(id=>objectIds.has(id)||diseaseIds.has(id));
    const objectMatch=objectIds.has(f.subjectId)||objectIds.has(f.objectId);
    const lexicalMatches=analysis.tokens.filter(t=>index.factText.get(f.id)!.includes(t));
    if(!entityMatches.length&&!lexicalMatches.length)return [];
    // An explicit object must matter; disease-only edges cannot fill all slots for an unknown food.
    if(objectIds.size&&!objectMatch&&lexicalMatches.every(t=>analysis.matched.some(e=>e.kind==='disease'&&[e.name,...e.aliases].some(n=>normalize(n).includes(t)))))return [];
    return [{fact:f,applicability:applicable,entityScore:Number(objectMatch)*8+Number(diseaseIds.has(f.subjectId))*4,
      lexicalScore:lexicalMatches.reduce((n,t)=>n+Math.min(4,t.length),0),entityMatches,lexicalMatches}];
  });
  const entityRanks=new Map(candidates.filter(c=>c.entityScore>0).sort((a,b)=>b.entityScore-a.entityScore||b.lexicalScore-a.lexicalScore||a.fact.id.localeCompare(b.fact.id)).map((c,i)=>[c.fact.id,i+1]));
  const lexicalRanks=new Map(candidates.filter(c=>c.lexicalScore>0).sort((a,b)=>b.lexicalScore-a.lexicalScore||b.entityScore-a.entityScore||a.fact.id.localeCompare(b.fact.id)).map((c,i)=>[c.fact.id,i+1]));
  const citation=(id:string)=>{const e=index.evidence.get(id)!,s=index.sources.get(e.sourceId)!;return {evidenceId:id,title:s.title,url:s.url,locator:e.locator,sourceHash:e.sourceHash};};
  const hits=candidates.map(c=>{
    const ids=[...new Set([...c.fact.evidenceIds,...c.fact.qualifyingEvidenceIds])];
    const er=entityRanks.get(c.fact.id),lr=lexicalRanks.get(c.fact.id);
    return {fact:c.fact,score:(er?1/(60+er):0)+(lr?1/(60+lr):0),applicability:c.applicability,
      channels:{entityRank:er??null,lexicalRank:lr??null,matchedEntityIds:c.entityMatches,matchedTokens:c.lexicalMatches},
      citations:ids.map(citation),conflicts:bundle.conflicts.filter(x=>x.factIds?.includes(c.fact.id)||x.evidenceIds?.some(id=>ids.includes(id)))};
  }).sort((a,b)=>b.score-a.score||a.fact.id.localeCompare(b.fact.id)).slice(0,limit);
  // Required evidence and attached exceptions are outside top-k discovery, never silently dropped.
  const requiredQualifiers=bundle.facts.filter(f=>f.evidenceIds.some(id=>required.includes(id))).flatMap(f=>f.qualifyingEvidenceIds);
  const requested=[...new Set([...required,...requiredQualifiers])];
  const missingRequired=requested.filter(id=>!evidenceActive(id));
  const state=missingRequired.length?'evidence_missing':unresolved.length?'needs_confirmation':hits.length?'research_results':'insufficient_evidence';
  return {state,message:unresolved.length?'疾病分型或食品形态待确认；候选名称不会自动成为已确认身份。':undefined,
    clinicalRelease:null,executionAllowed:false,index:'lexical-v2',hits,
    queryAnalysis:{mentions:analysis.mentions,unresolved,requestedAction:analysis.requestedAction},
    evidencePack:{required:required.filter(evidenceActive).map(citation),qualifying:[...new Set(requiredQualifiers)].filter(evidenceActive).map(citation),missingRequired},
    combinationSupport:diseaseIds.size>1?'not_evaluated':'single_topic_or_unspecified'};
}
