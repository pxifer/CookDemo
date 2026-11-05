import type { KnowledgeBundle } from '../../../shared/health-knowledge';
import { factAvailability } from '../health-knowledge';
import { evidenceActive, retrieveRagContext } from './retrieval';
import type { EmbeddingProvider, RagContext, RagGenerated, RagGenerator, RagQuestion, RagResult, RagVectorStore } from './types';

export function validateRagOutput(raw: unknown, context: RagContext): RagGenerated {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('RAG_OUTPUT_INVALID');
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.claims) || value.claims.length < 1 || value.claims.length > 4 || !Array.isArray(value.limitations) || value.limitations.length > 20 || value.limitations.some(item => typeof item !== 'string' || item.length > 500)) throw Error('RAG_OUTPUT_INVALID');
  const claims = value.claims.map((candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object') throw Error('RAG_CLAIM_INVALID');
    const claim = candidate as Record<string, unknown>;
    if (typeof claim.text !== 'string' || !claim.text.trim() || claim.text.length > 500 || !Array.isArray(claim.factIds) || !claim.factIds.length || claim.factIds.length > 20 || !Array.isArray(claim.evidenceIds) || !claim.evidenceIds.length || claim.evidenceIds.length > 40) throw Error('RAG_CLAIM_INVALID');
    const factIds = [...new Set(claim.factIds)] as string[], evidenceIds = [...new Set(claim.evidenceIds)] as string[];
    if (factIds.some(id => typeof id !== 'string' || !context.facts.some(hit => hit.fact.id === id)) || evidenceIds.some(id => typeof id !== 'string' || !context.evidence.some(item => item.evidence.id === id))) throw Error('RAG_CITATION_OUTSIDE_CONTEXT');
    for (const id of factIds) {
      const fact = context.facts.find(hit => hit.fact.id === id)!.fact;
      if (!fact.evidenceIds.some(evidenceId => evidenceIds.includes(evidenceId)) || fact.qualifyingEvidenceIds.some(evidenceId => !evidenceIds.includes(evidenceId))) throw Error('RAG_REQUIRED_CITATION_MISSING');
    }
    return { text: claim.text.trim(), factIds, evidenceIds };
  });
  const answer = claims.map(claim => claim.text).join('\n');
  if (answer.length > 8000 || value.answer !== undefined && value.answer !== answer) throw Error('RAG_UNCITED_ANSWER_TEXT');
  return { answer, claims, limitations: value.limitations as string[] };
}
export async function answerRag(bundle: KnowledgeBundle, store: RagVectorStore, embedding: EmbeddingProvider,
  generator: RagGenerator, indexId: string, question: RagQuestion,
  options: Parameters<typeof retrieveRagContext>[5] = {}): Promise<RagResult> {
  const unavailable = (reason: string): RagResult => ({ status: 'unavailable', executionAllowed: false, clinicalRelease: null, reason });
  try {
    const prepared = await retrieveRagContext(bundle, store, embedding, indexId, question, options);
    if (prepared.status !== 'ready' || !prepared.context) return { status: prepared.status === 'ready' ? 'unavailable' : prepared.status, executionAllowed: false, clinicalRelease: null, reason: prepared.reason, ...(prepared.missingConditions ? { missingConditions: prepared.missingConditions } : {}) };
    const context = prepared.context;
    const check = async () => {
      const revoked = new Set([...(await store.revocations()), ...options.revoked ?? []]);
      return ![indexId, bundle.id].some(id => revoked.has(id))
        && context.facts.every(hit => factAvailability(bundle, hit.fact, question.context, revoked) === 'applicable_for_research')
        && context.evidence.every(item => evidenceActive(bundle, item.evidence.id, revoked));
    };
    if (!await check()) return unavailable('RAG_EVIDENCE_CHANGED_BEFORE_GENERATION');
    const generated = await generator.generate(context, options.signal);
    if (!await check()) return unavailable('RAG_EVIDENCE_CHANGED_DURING_GENERATION');
    const answer = validateRagOutput(generated.output, context);
    return { status: 'answered', executionAllowed: false, clinicalRelease: null, context, answer, ...(generated.invocation ? { invocation: generated.invocation } : {}) };
  } catch (error) {
    const code = error instanceof Error && /^RAG_[A-Z_0-9]+$/.test(error.message) ? error.message : 'RAG_COMPONENT_UNAVAILABLE';
    return unavailable(code);
  }
}

/** Offline contract fixture. It never creates a provider receipt or claims to be a live LLM. */
export class ExtractiveFixtureGenerator implements RagGenerator {
  async generate(context: RagContext) {
    return { output: { claims: context.facts.slice(0, 3).map(({ fact }) => ({ text: fact.statement,
      factIds: [fact.id], evidenceIds: [...fact.evidenceIds, ...fact.qualifyingEvidenceIds] })),
    limitations: ['离线抽取夹具，仅验证检索、引用和接口契约，不是真实模型生成。'] } };
  }
}
