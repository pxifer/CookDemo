import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { connectDatabase } from '../backend/src/db';
import { HealthKnowledgeRepository } from '../backend/src/health-knowledge-repository';
import { canonicalKnowledgeHash, sha256, validateKnowledgeBundle } from '../backend/src/health-knowledge';
import { LocalEmbeddingProvider } from '../backend/src/rag/embedding';
import { PgRagVectorStore } from '../backend/src/rag/storage';
import { retrieveRagContext, ragRetrievalPolicy } from '../backend/src/rag/retrieval';
import { answerRag, ExtractiveFixtureGenerator } from '../backend/src/rag/pipeline';
import { DeepSeekRagGenerator } from '../backend/src/rag/generation';
import { openRagBudget, type RagAuthorization, type RagBudget, type RagPricing } from '../backend/src/rag/budget';
import type { EmbeddingBatch, EmbeddingProvider, EvidenceVector, RagQuestion, RagResult, RagStatus } from '../backend/src/rag/types';
import { assertLocalTestDatabase } from './lib/local-test-config';
import { synchronizeLegacyRagRevocations } from './lib/rag-legacy-revocations';

interface Case {
  id: string; split: string; question: string; context: Record<string, string>; mode: 'hybrid';
  expectedStatus: RagStatus; expectedFactIds: string[]; expectedEvidenceIds: string[];
  requiredEvidenceIds: string[]; forbiddenFactIds: string[]; suggestedLiveSmoke?: boolean;
  fault?: { revokedTargets?: string[] };
}
interface EvaluationRow {
  id: string; split: string; mode: string; status: string; expectedStatus: string; statusCorrect: boolean;
  factRecallAt10: number | null; reciprocalRank: number; ndcgAt10: number | null; forbiddenAt10: string[];
  expectedEvidenceInContext: number; expectedEvidenceCount: number; closureComplete: boolean;
  ranks: number[]; topFacts: string[]; reason: string | null; elapsedMs: number;
}
if (process.argv.includes('--help')) {
  console.log('RAG: index|query|evaluate|smoke; --index-id ID --case-id ID --question TEXT --context JSON --mode a1|dense|hybrid --output DIR --limit N. Default generation is an offline extractive fixture. Live public cases require --live plus RAG_ALLOW_LIVE=1 and a fresh active, bounded authorization. See agent-design/docs/runbook.md.');
  process.exit(0);
}
const args = process.argv.slice(2), task = args.shift();
const allowed = new Set(['--question', '--context', '--index-id', '--case-id', '--mode', '--output', '--limit', '--live']);
const flags = new Map<string, string>();
for (let i = 0; i < args.length; i++) {
  const name = args[i]; if (!allowed.has(name) || flags.has(name)) throw Error('RAG_ARGUMENT_INVALID');
  if (name === '--live') flags.set(name, '1');
  else { const value = args[++i]; if (!value || value.startsWith('--')) throw Error('RAG_ARGUMENT_VALUE_REQUIRED'); flags.set(name, value); }
}
const live = flags.has('--live');
if (live && (process.env.RAG_ALLOW_LIVE !== '1' || process.env.SHIWEI_LOCAL_TEST_ONLY === '1' || process.env.EVALUATION_ALLOW_PAID === '0')) throw Error('RAG_LIVE_EXPLICIT_OPT_IN_REQUIRED');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const interactive = task === 'query' && !flags.has('--case-id');
const output = flags.get('--output') ?? (interactive ? `.local-data/rag/queries/${runId}` : `artifacts/acceptance/rag-${task}-${runId}`);
if (interactive && !resolve(output).startsWith(resolve('.local-data/rag/queries') + sep)) throw Error('RAG_INTERACTIVE_OUTPUT_MUST_BE_PRIVATE');
const provider = new LocalEmbeddingProvider();
class MemoProvider implements EmbeddingProvider {
  private cache = new Map<string, Promise<EmbeddingBatch>>();
  readonly observations: { inputHash: string; elapsedMs: number; tokens: number }[] = [];
  describe(signal?: AbortSignal) { return provider.describe(signal); }
  embed(texts: string[], role: 'query' | 'document', signal?: AbortSignal) {
    const key = JSON.stringify({ texts, role });
    if (!this.cache.has(key)) {
      const begin = performance.now();
      this.cache.set(key, provider.embed(texts, role, signal).then(batch => {
        this.observations.push({ inputHash: sha256(key), elapsedMs: performance.now() - begin, tokens: batch.tokenCounts.reduce((a, b) => a + b, 0) });
        return batch;
      }));
    }
    return this.cache.get(key)!;
  }
}
async function bundleInput() {
  const catalog = JSON.parse(await readFile('datasets/health/catalog.json', 'utf8'));
  const version: string = catalog.defaultBundle;
  if (!/^\d{4}-\d{2}-\d{2}-v\d+$/.test(version) || !catalog.versions.includes(version)) throw Error('RAG_BUNDLE_VERSION_INVALID');
  const directory = `datasets/health/${version}`;
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  for (const [file, hash] of Object.entries(manifest.files)) if (basename(file) !== file || sha256(await readFile(join(directory, file))) !== hash) throw Error('RAG_BUNDLE_HASH_MISMATCH');
  return { bundle: validateKnowledgeBundle(JSON.parse(await readFile(join(directory, 'knowledge-bundle.json'), 'utf8'))), manifest };
}
async function testCases(): Promise<Case[]> {
  const data = JSON.parse(await readFile('datasets/evaluation/rag-acceptance-v1.json', 'utf8'));
  if (data.id !== 'shiwei-rag-acceptance-v1') throw Error('RAG_DATASET_INVALID');
  return data.cases;
}
async function liveGenerator(): Promise<{ generator: DeepSeekRagGenerator; budget: RagBudget }> {
  const authorization: RagAuthorization = JSON.parse(await readFile('.local-data/rag/live-authorization.json', 'utf8'));
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const pricing: RagPricing = JSON.parse(await readFile(`.local-data/rag/pricing-${day}.json`, 'utf8'));
  const budget = await openRagBudget(authorization, pricing, '.local-data/rag/live-budget.jsonl');
  try {
    const key = (await readFile(process.env.RAG_DEEPSEEK_KEY_FILE ?? '.local-data/evaluation/deepseek-key.txt', 'utf8')).trim();
    return { generator: new DeepSeekRagGenerator(key, budget), budget };
  }
  catch (error) { await budget.close(); throw error; }
}
const summarizeLatency = (samples: number[]) => { const sorted = [...samples].sort((a, b) => a - b); return { samples: samples.length, p50ms: sorted[Math.floor(sorted.length * .5)] ?? null, p95ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] ?? null }; };
async function main() {
  if (!['index', 'query', 'evaluate', 'smoke'].includes(task ?? '')) throw Error('RAG_TASK_REQUIRED');
  if (live && !['query', 'smoke'].includes(task!)) throw Error('RAG_LIVE_ONLY_FOR_PUBLIC_SMOKE');
  const databaseUrl = (await readFile(process.env.RAG_DATABASE_URL_FILE ?? '.local-data/rag/database-url', 'utf8')).trim();
  assertLocalTestDatabase(databaseUrl);
  if (new URL(databaseUrl).pathname !== '/shiwei_rag_research' && !/^\/shiwei_rag_test_[a-z0-9_]+$/.test(new URL(databaseUrl).pathname)) throw Error('RAG_ISOLATED_DATABASE_REQUIRED');
  const database = await connectDatabase(databaseUrl, { max: 2, queryTimeoutMs: 30000 });
  let budget: RagBudget | undefined;
  try {
    const { bundle, manifest: bundleManifest } = await bundleInput();
    const research = new HealthKnowledgeRepository(database);
    await research.initializeResearchSchema(); await research.importResearch(bundle, bundleManifest);
    const legacyRevocations = await synchronizeLegacyRagRevocations(research);
    const store = new PgRagVectorStore(database); await store.initialize();
    await mkdir(output, { recursive: true });
    if (task === 'index') {
      const identity = await provider.describe();
      const indexId = flags.get('--index-id') ?? `evidence-${sha256(bundle.id + canonicalKnowledgeHash(identity)).slice(0, 20)}`;
      const vectors: EvidenceVector[] = [], times: number[] = [], tokens: number[] = [];
      for (let start = 0; start < bundle.evidence.length; start += 8) {
        const rows = bundle.evidence.slice(start, start + 8), begin = performance.now();
        const batch = await provider.embed(rows.map(row => row.retrievalText), 'document');
        if (canonicalKnowledgeHash(batch.identity) !== canonicalKnowledgeHash(identity)) throw Error('RAG_MODEL_CHANGED_DURING_INDEX');
        times.push(performance.now() - begin); tokens.push(...batch.tokenCounts);
        rows.forEach((row, index) => vectors.push({ evidenceId: row.id, textHash: sha256(row.retrievalText), vector: batch.vectors[index] }));
        console.log(JSON.stringify({ indexed: Math.min(start + 8, bundle.evidence.length), total: bundle.evidence.length, model: identity.modelId }));
      }
      const result = await store.putIndex(indexId, bundle, identity, vectors);
      await mkdir('.local-data/rag/indexes', { recursive: true });
      await writeFile('.local-data/rag/current-index.json', JSON.stringify({ indexId, modelId: identity.modelId }) + '\n');
      await writeFile(join('.local-data/rag/indexes', indexId + '.json'), JSON.stringify(result, null, 2) + '\n');
      await writeFile(join(output, 'index.json'), JSON.stringify({ manifest: result, batchLatency: summarizeLatency(times), maxInputTokens: Math.max(...tokens), totalInputTokens: tokens.reduce((a, b) => a + b, 0), realEmbedding: true, paidCalls: 0, approximateIndex: false }, null, 2) + '\n');
      console.log(JSON.stringify({ status: 'persisted', indexId, chunks: result.chunks, model: identity.modelId, output }));
      return;
    }
    const indexId = flags.get('--index-id') ?? JSON.parse(await readFile('.local-data/rag/current-index.json', 'utf8')).indexId;
    const index = await store.manifest(indexId);
    const cases = await testCases(), memo = new MemoProvider();
    if (task === 'evaluate') {
      const rows: EvaluationRow[] = [];
      for (const mode of ['a1', 'dense', 'hybrid'] as const) for (const item of cases) {
        const begin = performance.now();
        const result = await retrieveRagContext(bundle, store, memo, indexId, { question: item.question, context: item.context, mode, requiredEvidenceIds: item.requiredEvidenceIds }, { revoked: new Set(item.fault?.revokedTargets ?? []) });
        const ids = result.rankedFacts.slice(0, 10).map(hit => hit.fact.id);
        const ranks = item.expectedFactIds.map(id => ids.indexOf(id) + 1);
        const status = result.status === 'ready' ? 'answered' : result.status;
        const evidenceIds = new Set(result.context?.evidence.map(item => item.evidence.id) ?? []);
        const closureComplete = !result.context || result.context.facts.every(hit => [...hit.fact.evidenceIds, ...hit.fact.qualifyingEvidenceIds].every(id => evidenceIds.has(id)));
        const dcg = ids.reduce((sum, id, position) => sum + (item.expectedFactIds.includes(id) ? 1 / Math.log2(position + 2) : 0), 0);
        const ideal = item.expectedFactIds.slice(0, 10).reduce((sum, _, position) => sum + 1 / Math.log2(position + 2), 0);
        rows.push({ id: item.id, split: item.split, mode, status, expectedStatus: item.expectedStatus, statusCorrect: status === item.expectedStatus,
          factRecallAt10: ranks.length ? ranks.filter(rank => rank > 0).length / ranks.length : null,
          reciprocalRank: ranks.some(rank => rank > 0) ? 1 / Math.min(...ranks.filter(rank => rank > 0)) : 0,
          ndcgAt10: ideal ? dcg / ideal : null, forbiddenAt10: item.forbiddenFactIds.filter(id => ids.includes(id)),
          expectedEvidenceInContext: item.expectedEvidenceIds.filter(id => evidenceIds.has(id)).length,
          expectedEvidenceCount: item.expectedEvidenceIds.length, closureComplete, ranks, topFacts: ids, reason: result.reason ?? null, elapsedMs: performance.now() - begin });
      }
      const summary = ['a1', 'dense', 'hybrid'].map(mode => {
        const selected = rows.filter(row => row.mode === mode), positive = selected.filter(row => row.factRecallAt10 !== null);
        return { mode, cases: selected.length, correctStates: selected.filter(row => row.statusCorrect).length,
          recallAt10: positive.reduce((sum, row) => sum + row.factRecallAt10!, 0) / positive.length,
          mrr: positive.reduce((sum, row) => sum + row.reciprocalRank, 0) / positive.length,
          ndcgAt10: positive.reduce((sum, row) => sum + row.ndcgAt10!, 0) / positive.length,
          evidenceClosureComplete: selected.every(row => row.closureComplete), latency: summarizeLatency(selected.map(row => row.elapsedMs)) };
      });
      await writeFile(join(output, 'evaluation.json'), JSON.stringify({ dataset: 'shiwei-rag-acceptance-v1', index, retrievalPolicy: ragRetrievalPolicy, legacyRevocations, realEmbedding: true, generation: 'not_run', realModelCalls: 0,
        scope: 'Source-derived engineering comparison, not independent clinical quality. Query-vector memoization is per process and shared between dense/hybrid; observed mode latency is not a cold-model comparison. Compare models using the separately measured unique query encoding latency.',
        queryEncodingLatency: summarizeLatency(memo.observations.map(row => row.elapsedMs)), queryEncodingObservations: memo.observations, summary, rows }, null, 2) + '\n');
      console.log(JSON.stringify({ indexId, model: index.identity.modelId, summary, output }));
      return;
    }
    let generator = new ExtractiveFixtureGenerator() as import('../backend/src/rag/types').RagGenerator;
    const selected = task === 'smoke' ? cases.filter(item => item.suggestedLiveSmoke).slice(0, Number(flags.get('--limit') ?? 6))
      : flags.has('--case-id') ? cases.filter(item => item.id === flags.get('--case-id')) : [];
    if (live && (!selected.length || flags.has('--question') || flags.has('--context'))) throw Error('RAG_LIVE_PUBLIC_CASE_REQUIRED');
    if (task === 'query' && !flags.has('--case-id')) selected.push({ id: 'interactive-local', question: flags.get('--question') ?? '', context: JSON.parse(flags.get('--context') ?? '{}'), mode: (flags.get('--mode') ?? 'hybrid') as 'hybrid', requiredEvidenceIds: [], expectedStatus: 'answered', expectedFactIds: [], expectedEvidenceIds: [], forbiddenFactIds: [], split: 'interactive' });
    if (!selected.length) throw Error('RAG_CASE_NOT_FOUND');
    if (live) { const session = await liveGenerator(); generator = session.generator; budget = session.budget; }
    const beforeAttempts = budget?.summary().attempts ?? 0;
    const results: { id: string; elapsedMs: number; result: RagResult }[] = [];
    for (const item of selected) {
      const begin = performance.now();
      const question: RagQuestion = { question: item.question, context: item.context, mode: item.mode, requiredEvidenceIds: item.requiredEvidenceIds };
      const result = await answerRag(bundle, store, memo, generator, indexId, question, { revoked: new Set(item.fault?.revokedTargets ?? []) });
      results.push({ id: item.id, elapsedMs: performance.now() - begin, result });
      console.log(JSON.stringify({ id: item.id, status: result.status, reason: result.reason, providerCalled: Boolean(result.invocation) }));
      // A failed paid attempt is not retried and stops this invocation; it remains in the durable budget.
      if (live && result.status === 'unavailable') break;
    }
    await writeFile(join(output, 'answers.json'), JSON.stringify({ index, retrievalPolicy: ragRetrievalPolicy, legacyRevocations, generation: live ? 'real_deepseek' : 'extractive_fixture_not_live_llm', realEmbedding: true,
      realModelCalls: (budget?.summary().attempts ?? 0) - beforeAttempts,
      verifiedReceipts: results.filter(row => row.result.invocation).length, budget: budget?.summary() ?? null, results,
      humanGroundingReview: 'pending: valid citation IDs alone do not establish entailment or clinical suitability' }, null, 2) + '\n');
    console.log(JSON.stringify({ output, generation: live ? 'real_deepseek' : 'extractive_fixture', budget: budget?.summary() ?? null }));
    if (results.some(row => row.result.status === 'unavailable')) process.exitCode = 1;
  } finally { await budget?.close(); await database.close(); }
}
main().catch(error => { console.error(error instanceof Error && /^RAG_[A-Z_0-9]+$/.test(error.message) ? error.message : 'RAG_CLI_FAILED: inspect local configuration; credentials omitted'); process.exitCode = 1; });
