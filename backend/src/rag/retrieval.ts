import { canonicalKnowledgeHash, factAvailability, searchKnowledge, sha256 } from '../health-knowledge';
import { effectiveKnowledgeRevocations } from '../health-knowledge-policy';
import { resolveKnowledgeQuery } from '../health-knowledge-retrieval';
import { estimatedTokens } from '../../../shared/context-budget';
import type { KnowledgeBundle, KnowledgeFact } from '../../../shared/health-knowledge';
import type { EmbeddingProvider, RagContext, RagFactHit, RagQuestion, RagStatus, RagVectorStore } from './types';

export interface RagRetrieval {
  status: 'ready' | Exclude<RagStatus, 'answered'>;
  reason?: string;
  context?: RagContext;
  rankedFacts: RagFactHit[];
  missingConditions?: string[];
}
export const ragRetrievalPolicy = {
  version: 'fact-scope-v2', rrfConstant: 60, lexicalWeight: 2, denseWeight: 1,
  retrievalOnlyShorthandAliases: ['不饱和脂肪→不饱和脂肪酸', '原发性骨质疏松→原发性骨质疏松症'],
  unknownRequestedGuidanceConditionsStopBeforeRanking: true,
} as const;
export function revocationWatermark(revoked: ReadonlySet<string>) { return sha256(JSON.stringify([...revoked].sort())); }
/** Retrieval-only shorthand normalization. It does not mutate facts, diagnoses or user settings. */
function retrievalQuestion(question: string) {
  return question.replace(/不饱和脂肪(?!酸)/g, '不饱和脂肪酸').replace(/原发性骨质疏松(?!症)/g, '原发性骨质疏松症');
}
export function evidenceActive(bundle: KnowledgeBundle, id: string, revoked: ReadonlySet<string>) {
  const evidence = bundle.evidence.find(row => row.id === id);
  const source = evidence && bundle.sources.find(row => row.id === evidence.sourceId);
  const blocked = effectiveKnowledgeRevocations(bundle, revoked);
  return Boolean(evidence && source && evidence.status === 'active' && source.status === 'active'
    && ![bundle.id, evidence.id, source.id, `${source.id}@${source.version}`, source.sourceHash].some(value => blocked.has(value)));
}
function eligible(bundle: KnowledgeBundle, fact: KnowledgeFact, request: RagQuestion, revoked: Set<string>) {
  const state = factAvailability(bundle, fact, request.context, revoked);
  if (['withdrawn', 'evidence_missing', 'not_applicable'].includes(state)) return false;
  const analysis = resolveKnowledgeQuery(bundle, retrievalQuestion(request.question));
  const diseaseIds = new Set(request.diseaseId ? [request.diseaseId] : analysis.matched.filter(e => e.kind === 'disease').map(e => e.id));
  const foods = new Set(analysis.matched.filter(e => e.kind === 'food' || e.kind === 'food_group').map(e => e.id));
  const components = new Set(analysis.matched.filter(e => e.kind === 'component').map(e => e.id));
  const processes = new Set(analysis.matched.filter(e => e.kind === 'process').map(e => e.id));
  // A food-composition question must not be displaced by an unrelated disease rule
  // simply because both facts cite a paper mentioning the same component.
  if (!diseaseIds.size && foods.size && (fact.kind === 'disease_component' || fact.kind === 'food_guidance' || fact.kind === 'cooking_effect' && !processes.size)) return false;
  if (diseaseIds.size && ['disease_component', 'food_guidance'].includes(fact.kind) && !diseaseIds.has(fact.subjectId)) return false;
  if (foods.size && fact.kind === 'food_component' && !foods.has(fact.subjectId)) return false;
  if (foods.size && fact.kind === 'food_guidance' && !foods.has(fact.objectId) && !processes.has(fact.objectId)) return false;
  if (components.size && bundle.entities.some(e => e.id === fact.objectId && e.kind === 'component') && !components.has(fact.objectId)) return false;
  if (processes.size && fact.kind === 'cooking_effect' && !processes.has(fact.subjectId)) return false;
  return true;
}
export async function retrieveRagContext(bundle: KnowledgeBundle, store: RagVectorStore, embedding: EmbeddingProvider,
  indexId: string, request: RagQuestion, options: { maxFacts?: number; contextTokens?: number; denseLimit?: number; revoked?: ReadonlySet<string>; signal?: AbortSignal } = {}): Promise<RagRetrieval> {
  const empty = (status: RagRetrieval['status'], reason: string): RagRetrieval => ({ status, reason, rankedFacts: [] });
  if (typeof request.question !== 'string' || !request.question.trim() || request.question.length > 1000) return empty('unavailable', 'RAG_QUESTION_INVALID');
  if (request.context && (Object.keys(request.context).length > 30 || Object.entries(request.context).some(([key, value]) => !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) || value !== undefined && (typeof value !== 'string' || value.length > 120)))) return empty('unavailable', 'RAG_CONTEXT_INVALID');
  if (request.diseaseId && !bundle.entities.some(e => e.id === request.diseaseId && e.kind === 'disease')) return empty('unavailable', 'RAG_DISEASE_UNKNOWN');
  if (request.mode && !['a1', 'dense', 'hybrid'].includes(request.mode)) return empty('unavailable', 'RAG_MODE_INVALID');
  const revoked = effectiveKnowledgeRevocations(bundle, [...(await store.revocations()), ...options.revoked ?? []]);
  if ([bundle.id, indexId].some(id => revoked.has(id) || bundle.revocations.includes(id))) return empty('insufficient_evidence', 'RAG_INDEX_OR_BUNDLE_WITHDRAWN');
  const required = request.requiredEvidenceIds ?? [];
  if (required.length > 100 || required.some(id => !evidenceActive(bundle, id, revoked))) return empty('insufficient_evidence', 'RAG_REQUIRED_EVIDENCE_UNAVAILABLE');
  const lexical = searchKnowledge(bundle, retrievalQuestion(request.question), { context: request.context, diseaseId: request.diseaseId, revoked, requiredEvidenceIds: required, limit: 50 });
  if (lexical.state === 'evidence_missing') return empty('insufficient_evidence', 'RAG_REQUIRED_EVIDENCE_UNAVAILABLE');
  if (lexical.state === 'needs_confirmation' || lexical.combinationSupport === 'not_evaluated') return empty('needs_confirmation', 'RAG_IDENTITY_OR_COMBINATION_UNCONFIRMED');
  const analysis = resolveKnowledgeQuery(bundle, retrievalQuestion(request.question));
  const requestedDiseases = new Set([...analysis.matched.filter(entity => entity.kind === 'disease').map(entity => entity.id), ...request.diseaseId ? [request.diseaseId] : []]);
  if (requestedDiseases.size > 1) return empty('needs_confirmation', 'RAG_COMBINATION_NOT_EVALUATED');
  if (analysis.mentions.some(mention => mention.negated && mention.ids.some(id => bundle.entities.some(e => e.id === id && e.kind === 'disease')))) return empty('needs_confirmation', 'RAG_NEGATED_DISEASE_REQUIRES_CLARIFICATION');
  if (!analysis.matched.length && !request.diseaseId) return empty('insufficient_evidence', 'RAG_NO_SUPPORTED_ENTITY');
  const askedObjects = new Set(analysis.matched.filter(entity => entity.kind !== 'disease').map(entity => entity.id));
  const conditionalTargets = bundle.facts.filter(fact => requestedDiseases.has(fact.subjectId)
    && ['food_guidance', 'disease_component'].includes(fact.kind)
    && (!askedObjects.size || askedObjects.has(fact.objectId)));
  const unknownTargets = conditionalTargets.filter(fact => factAvailability(bundle, fact, request.context, revoked) === 'needs_confirmation');
  if (unknownTargets.length) {
    return { ...empty('needs_confirmation', 'RAG_REQUESTED_GUIDANCE_CONDITIONS_UNKNOWN'), missingConditions: [...new Set(unknownTargets.flatMap(fact => fact.conditions.filter(condition => request.context?.[condition.key] === undefined || request.context[condition.key] === 'unknown').map(condition => condition.key)))] };
  }
  const manifest = await store.manifest(indexId);
  if (manifest.bundleId !== bundle.id || manifest.bundleHash !== canonicalKnowledgeHash(bundle) || manifest.chunks !== bundle.evidence.length) return empty('unavailable', 'RAG_INDEX_BUNDLE_MISMATCH');
  const mode = request.mode ?? 'hybrid';
  const lexicalRanks = new Map(lexical.hits.filter(hit => eligible(bundle, hit.fact, request, revoked)).map((hit, index) => [hit.fact.id, index + 1]));
  const denseRanks = new Map<string, number>();
  if (mode !== 'a1') {
    const identity = await embedding.describe(options.signal);
    if (canonicalKnowledgeHash(identity) !== canonicalKnowledgeHash(manifest.identity)) return empty('unavailable', 'RAG_EMBEDDING_INDEX_MISMATCH');
    const batch = await embedding.embed([request.question], 'query', options.signal);
    if (canonicalKnowledgeHash(batch.identity) !== canonicalKnowledgeHash(identity) || batch.vectors.length !== 1) return empty('unavailable', 'RAG_QUERY_EMBEDDING_INVALID');
    const dense = await store.search(indexId, batch.vectors[0], options.denseLimit ?? 30);
    for (const [index, hit] of dense.entries()) {
      if (!evidenceActive(bundle, hit.evidenceId, revoked)) continue;
      for (const fact of bundle.facts) {
        if (![...fact.evidenceIds, ...fact.qualifyingEvidenceIds].includes(hit.evidenceId) || !eligible(bundle, fact, request, revoked)) continue;
        if (!denseRanks.has(fact.id)) denseRanks.set(fact.id, index + 1);
      }
    }
  }
  const rankedFacts = bundle.facts.flatMap(fact => {
    const lexicalRank = lexicalRanks.get(fact.id), denseRank = denseRanks.get(fact.id);
    const score = (mode !== 'dense' && lexicalRank ? ragRetrievalPolicy.lexicalWeight / (ragRetrievalPolicy.rrfConstant + lexicalRank) : 0)
      + (mode !== 'a1' && denseRank ? ragRetrievalPolicy.denseWeight / (ragRetrievalPolicy.rrfConstant + denseRank) : 0);
    return score ? [{ fact, score, applicability: factAvailability(bundle, fact, request.context, revoked), lexicalRank, denseRank }] : [];
  }).sort((a, b) => b.score - a.score || a.fact.id.localeCompare(b.fact.id));
  if (!rankedFacts.length) return empty('insufficient_evidence', 'RAG_NO_APPLICABLE_EVIDENCE');
  const missingConditions = [...new Set(rankedFacts.slice(0, options.maxFacts ?? 8).flatMap(hit => hit.fact.conditions.filter(condition => request.context?.[condition.key] === undefined || request.context[condition.key] === 'unknown').map(condition => condition.key)))];
  if (rankedFacts[0].applicability === 'needs_confirmation') return { status: 'needs_confirmation', reason: 'RAG_REQUIRED_CONDITIONS_UNKNOWN', rankedFacts, missingConditions };
  const selected: RagFactHit[] = [];
  const evidenceIds = new Set([...required, ...lexical.evidencePack.qualifying.map(item => item.evidenceId)]);
  const assemble = (): RagContext => ({
    question: request.question, bundleId: bundle.id, indexId, context: request.context ?? {}, facts: [...selected],
    evidence: [...evidenceIds].map(id => {
      const evidence = bundle.evidence.find(row => row.id === id)!;
      const source = bundle.sources.find(row => row.id === evidence.sourceId)!;
      return { evidence, source: { id: source.id, title: source.title, url: source.url, hash: source.sourceHash, version: source.version } };
    }),
    conflicts: bundle.conflicts.filter(conflict => conflict.factIds?.some(id => selected.some(hit => hit.fact.id === id)) || conflict.evidenceIds?.some(id => evidenceIds.has(id))),
    missingConditions: [], estimatedTokens: 0, revocationWatermark: revocationWatermark(revoked),
  });
  for (const hit of rankedFacts) {
    if (selected.length >= (options.maxFacts ?? 8) || hit.applicability !== 'applicable_for_research') continue;
    const ids = [...hit.fact.evidenceIds, ...hit.fact.qualifyingEvidenceIds];
    if (ids.some(id => !evidenceActive(bundle, id, revoked))) continue;
    const previous = new Set(evidenceIds);
    ids.forEach(id => evidenceIds.add(id)); selected.push(hit);
    if (estimatedTokens(JSON.stringify(assemble())) > (options.contextTokens ?? 6000)) {
      selected.pop(); evidenceIds.clear(); previous.forEach(id => evidenceIds.add(id));
    }
  }
  if (!selected.length) return { status: 'insufficient_evidence', reason: 'RAG_EVIDENCE_EXCEEDS_BUDGET', rankedFacts };
  const context = assemble();
  context.estimatedTokens = estimatedTokens(JSON.stringify(context));
  return { status: 'ready', context, rankedFacts };
}
