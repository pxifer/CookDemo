import { createHash } from 'node:crypto';
import Ajv from 'ajv';
import schema from '../../datasets/health/knowledge-bundle.schema.json';
import bodySchema from '../../datasets/health/knowledge-bundle-v1.1.schema.json';
import type { KnowledgeBundle, KnowledgeFact } from '../../shared/health-knowledge';
import { effectiveKnowledgeRevocations } from './health-knowledge-policy';
import { knowledgeLookup, searchKnowledgeA1, type KnowledgeSearchOptions } from './health-knowledge-retrieval';
export { resolveKnowledgeQuery } from './health-knowledge-retrieval';

const validate = new Ajv({ allErrors: true, strict: false }).compile<KnowledgeBundle>(schema);
const validateBody = new Ajv({ allErrors: true, strict: false }).compile<KnowledgeBundle>(bodySchema);
export const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export function canonicalKnowledgeHash(value: unknown): string {
  const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
  function canonical(v: unknown): unknown {
    if(Array.isArray(v)) {
      const rows=v.map(canonical);
      return rows.every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&typeof (x as {id?:unknown}).id==='string')
        ? rows.sort((a,b)=>compare((a as {id:string}).id,(b as {id:string}).id)):rows;
    }
    if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).sort(([a],[b])=>compare(a,b)).map(([k,x])=>[k,canonical(x)]));
    return v;
  }
  return sha256(JSON.stringify(canonical(value)));
}
const fail = (reason: string): never => { throw new Error(`HEALTH_KNOWLEDGE_INVALID: ${reason}`); };

export function validateKnowledgeBundle(raw: unknown): KnowledgeBundle {
  const validator=raw&&typeof raw==='object'&&(raw as Record<string,unknown>).schemaVersion==='1.1.0'?validateBody:validate;
  if (!validator(raw)) fail(JSON.stringify(validator.errors));
  const bundle = raw as KnowledgeBundle;
  function unique<T extends { id: string }>(rows: T[]) {
    const map = new Map(rows.map(row => [row.id, row]));
    if (map.size !== rows.length) fail('duplicate IDs');
    return map;
  }
  const sources = unique(bundle.sources), entities = unique(bundle.entities), evidence = unique(bundle.evidence), facts = unique(bundle.facts);
  unique(bundle.ruleDrafts); unique(bundle.conflicts);
  const evidenceKeys = new Set(bundle.evidence.map(e => e.key));
  if (evidenceKeys.size !== bundle.evidence.length) fail('duplicate evidence keys');
  for (const e of bundle.evidence) {
    const s = sources.get(e.sourceId);
    if (!s || s.version !== e.sourceVersion || s.sourceHash !== e.sourceHash) fail('source version/hash mismatch');
    if (sha256(e.originalSpan) !== e.spanHash) fail('span hash mismatch');
    if (e.locator.kind === 'pdf_visual' || e.locator.kind === 'html_visual') {
      if (!e.locator.verifiedPageImageHash || e.locator.start !== null || e.locator.end !== null) fail('unverified visual locator');
    } else if (e.locator.start === null || e.locator.end === null || e.locator.end - e.locator.start !== e.originalSpan.length) fail('bad character locator');
    if (e.locator.pdfPage !== null && e.locator.pdfPage > s!.pageCount) fail('page outside source');
  }
  const predicates: Record<KnowledgeFact['kind'], string[]> = {
    disease_component: ['adverse','beneficial_tendency','conditional','insufficient_evidence'],
    food_component: ['contains','may_contain','insufficient_evidence'],
    food_guidance: ['prefer','limit','avoid','insufficient_evidence'],
    cooking_effect: ['may_transfer','may_redistribute','mostly_retained','may_decrease','may_form','may_deposit','insufficient_evidence'],
  };
  for (const f of bundle.facts) {
    const a = entities.get(f.subjectId), b = entities.get(f.objectId);
    if (!a || !b || !predicates[f.kind].includes(f.predicate)) fail('invalid fact endpoints/predicate');
    const types: Record<KnowledgeFact['kind'], [string[], string[]]> = {
      disease_component: [['disease'],['component']], food_component: [['food','food_group'],['component']],
      food_guidance: [['disease'],['food','food_group','process']], cooking_effect: [['process'],['component']],
    };
    if (!types[f.kind][0].includes(a!.kind) || !types[f.kind][1].includes(b!.kind)) fail('entity type mismatch');
    const keys = f.conditions.map(c => c.key);
    if (new Set(keys).size !== keys.length) fail('duplicate condition keys');
    for (const id of [...f.evidenceIds, ...f.qualifyingEvidenceIds]) {
      const e = evidence.get(id);
      if (!e || f.sourceVersions[e.sourceId] !== e.sourceVersion) fail('missing evidence or unbound source version');
    }
    if (f.kind === 'food_guidance' && !f.evidenceIds.some(id => sources.get(evidence.get(id)!.sourceId)?.kind === 'national_guideline')) fail('food action needs direct food-level guideline evidence');
    const q = f.quantity;
    if (q) {
      if (f.kind !== 'food_component') fail('quantities are composition data, not per-meal limits');
      if (q.kind === 'classification_range' && (q.value !== null || q.upper === null || (q.lower !== null && q.lower > q.upper))) fail('invalid classification range');
      if (q.kind === 'reported_measurement' && (q.value === null || q.lower !== null || q.upper !== null || !q.sourceFoodLabel)) fail('invalid measurement');
    }
  }
  for (const r of bundle.ruleDrafts) if (facts.get(r.factId)?.kind !== 'food_guidance' || facts.get(r.factId)?.version !== r.version) fail('orphan rule');
  for (const c of bundle.conflicts) {
    if (c.factIds?.some(id => !facts.has(id)) || c.evidenceIds?.some(id => !evidence.has(id)) || (c.sourceId && !sources.has(c.sourceId))) fail('orphan conflict');
  }
  return bundle;
}

export function factAvailability(bundle: KnowledgeBundle, fact: KnowledgeFact, context: Record<string, string | undefined> = {}, revoked: ReadonlySet<string> = new Set()) {
  const lookup = knowledgeLookup(bundle);
  const blocked = effectiveKnowledgeRevocations(bundle, revoked);
  if (blocked.has(bundle.id) || blocked.has(fact.id) || blocked.has(`${fact.id}@${fact.version}`) || fact.withdrawnAt) return 'withdrawn';
  for (const id of [...fact.evidenceIds, ...fact.qualifyingEvidenceIds]) {
    const e = lookup.evidence.get(id);
    const s = e && lookup.sources.get(e.sourceId);
    if (!e || !s) return 'evidence_missing';
    if (e.status !== 'active' || s.status !== 'active' || blocked.has(e.id) || blocked.has(s.id) || blocked.has(`${s.id}@${s.version}`) || blocked.has(s.sourceHash)) return 'withdrawn';
  }
  // A known mismatch takes precedence over other missing conditions.
  if (fact.conditions.some(c => context[c.key] !== undefined && context[c.key] !== 'unknown' && !c.values.includes(context[c.key]!))) return 'not_applicable';
  if (fact.conditions.some(c => context[c.key] === undefined || context[c.key] === 'unknown')) return 'needs_confirmation';
  return 'applicable_for_research';
}

function queryTerms(bundle: KnowledgeBundle, query: string) {
  const normalized = query.normalize('NFKC').toLowerCase();
  const matched = bundle.entities.filter(e => [e.name,...e.aliases].some(name => normalized.includes(name.normalize('NFKC').toLowerCase())));
  // No class expansion: unqualified 香菇 is not silently mapped to either fresh or dried samples.
  return { normalized, matched };
}

/** Public research retrieval only. Never approves rules or returns recipe eligibility. */
export function searchKnowledgeA0(bundle: KnowledgeBundle, query: string, options: KnowledgeSearchOptions = {}) {
  if (!query.trim() || query.length > 1000) throw new Error('HEALTH_QUERY_INVALID');
  if (options.diseaseId && !bundle.entities.some(e => e.id === options.diseaseId && e.kind === 'disease')) throw new Error('HEALTH_DISEASE_UNKNOWN');
  const limit = Math.max(1, Math.min(50, options.limit ?? 10));
  const { normalized, matched } = queryTerms(bundle, query);
  const diseaseAmbiguous = /糖尿病/.test(query) && !matched.some(e => e.id === 'd:type2-diabetes');
  const diseaseIds = new Set(options.diseaseId ? [options.diseaseId] : matched.filter(e => e.kind === 'disease').map(e => e.id));
  const otherIds = new Set(matched.filter(e => e.kind !== 'disease').map(e => e.id));
  const hits = bundle.facts.flatMap(f => {
    const availability = factAvailability(bundle,f,options.context,options.revoked);
    if (['withdrawn','evidence_missing','not_applicable'].includes(availability)) return [];
    // Disease queries keep the disease edges plus composition/process edges only when their entity is requested.
    if (diseaseIds.size && (f.kind === 'disease_component' || f.kind === 'food_guidance')) {
      if (!diseaseIds.has(f.subjectId)) return [];
    }
    const entityScore = Number(diseaseIds.has(f.subjectId))*3 + Number(otherIds.has(f.subjectId))*5 + Number(otherIds.has(f.objectId))*5;
    const terms = [...normalized.matchAll(/[\p{Script=Han}]{2,}|[a-z0-9]+/gu)].map(m => m[0]);
    const keys = [...f.evidenceIds,...f.qualifyingEvidenceIds];
    const chunks = keys.map(id => bundle.evidence.find(e => e.id === id)!);
    const text = (f.statement+' '+chunks.map(e => e.retrievalText).join(' ')).toLowerCase();
    const keywordScore = terms.filter(t => text.includes(t)).length;
    if (!entityScore && !keywordScore) return [];
    const citations = chunks.map(e => ({ evidenceId:e.id, title:bundle.sources.find(s=>s.id===e.sourceId)!.title,
      url:bundle.sources.find(s=>s.id===e.sourceId)!.url, locator:e.locator, sourceHash:e.sourceHash }));
    return [{ fact:f, score:entityScore+keywordScore, applicability:availability, citations,
      conflicts:bundle.conflicts.filter(c => c.factIds?.includes(f.id) || c.evidenceIds?.some(id => keys.includes(id))) }];
  }).sort((a,b)=>b.score-a.score || a.fact.id.localeCompare(b.fact.id)).slice(0,limit);
  return { state:diseaseAmbiguous ? 'needs_confirmation' : hits.length ? 'research_results' : 'insufficient_evidence',
    message:diseaseAmbiguous ? '糖尿病分型待确认；本库疾病主题为成人2型糖尿病。' : undefined,
    clinicalRelease:null, executionAllowed:false, index:'lexical-v1', hits };
}

export function searchKnowledge(bundle: KnowledgeBundle, query: string, options?: KnowledgeSearchOptions & {algorithm?:'a1'}): ReturnType<typeof searchKnowledgeA1>;
export function searchKnowledge(bundle: KnowledgeBundle, query: string, options: KnowledgeSearchOptions & {algorithm:'a0'}): ReturnType<typeof searchKnowledgeA0>;
export function searchKnowledge(bundle: KnowledgeBundle, query: string, options: KnowledgeSearchOptions): ReturnType<typeof searchKnowledgeA0> | ReturnType<typeof searchKnowledgeA1>;
export function searchKnowledge(bundle: KnowledgeBundle, query: string, options: KnowledgeSearchOptions = {}) {
  return options.algorithm === 'a0' ? searchKnowledgeA0(bundle,query,options) : searchKnowledgeA1(bundle,query,options,factAvailability);
}
