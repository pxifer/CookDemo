import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalKnowledgeHash, validateKnowledgeBundle } from '../backend/src/health-knowledge';
import { answerRag, ExtractiveFixtureGenerator, validateRagOutput } from '../backend/src/rag/pipeline';
import { retrieveRagContext } from '../backend/src/rag/retrieval';
import type { DenseHit, EmbeddingIdentity, EmbeddingProvider, RagContext, RagGenerator, RagIndexManifest, RagQuestion, RagVectorStore } from '../backend/src/rag/types';

// Contract fixtures only: genuine frozen evidence and synthetic two-dimensional vectors.
// These tests do not claim to benchmark real embeddings or execute a real provider call.
const bundle = validateKnowledgeBundle(JSON.parse(await readFile(new URL('../datasets/health/2026-10-28-v2/knowledge-bundle.json', import.meta.url), 'utf8')));
const identity: EmbeddingIdentity = {
  modelId: 'synthetic-contract-only', revision: 'fixture-v1', dimensions: 2,
  normalization: 'l2', pooling: 'test', queryInstruction: 'contract query', documentInstruction: '',
  representationVersion: 'retrieval-text-v1', runtimeVersion: 'no-real-model',
};
const salt = bundle.facts.find(fact => fact.id === 'fact:ht-limit-salt')!;
const milk = bundle.facts.find(fact => fact.id === 'fact:gout-prefer-milk')!;
const juice = bundle.facts.find(fact => fact.id === 'fact:gout-limit-juice')!;
const normalQuestion = (): RagQuestion => ({ question: '成人高血压食盐怎样选择', context: { adult: 'yes' }, mode: 'hybrid' });
const goutContext = { adult: 'yes', renalFunction: 'normal', complexComorbidity: 'no' };

function fixture() {
  const calls = { describe: 0, embed: 0, search: 0, generate: 0, revocations: 0 };
  const state = {
    revoked: new Set<string>(),
    onRevocations: undefined as undefined | ((read: number) => void),
    dense: salt.evidenceIds.map((evidenceId, rank): DenseHit => ({ evidenceId, distance: rank / 10 })),
    manifest: {
      id: 'contract-index', bundleId: bundle.id, bundleHash: canonicalKnowledgeHash(bundle),
      identity: structuredClone(identity), chunks: bundle.evidence.length, state: 'ready' as const,
      createdAt: '2026-11-04T00:00:00.000Z',
    } as RagIndexManifest,
    batchIdentity: structuredClone(identity),
    context: undefined as RagContext | undefined,
  };
  const store: RagVectorStore = {
    putIndex: async () => { throw Error('Contract fixture does not build an index'); },
    manifest: async () => structuredClone(state.manifest),
    search: async () => { calls.search++; return structuredClone(state.dense); },
    revocations: async () => { state.onRevocations?.(++calls.revocations); return new Set(state.revoked); },
  };
  const embedding: EmbeddingProvider = {
    describe: async () => { calls.describe++; return structuredClone(identity); },
    embed: async () => { calls.embed++; return { identity: structuredClone(state.batchIdentity), vectors: [[1, 0]], tokenCounts: [8] }; },
  };
  const generator = (action?: (context: RagContext) => Promise<{output: unknown}> | {output: unknown}): RagGenerator => ({
    generate: async context => {
      calls.generate++; state.context = context;
      return action ? action(context) : new ExtractiveFixtureGenerator().generate(context);
    },
  });
  const answer = (question = normalQuestion(), action?: Parameters<typeof generator>[0], options: Parameters<typeof answerRag>[6] = {}) =>
    answerRag(bundle, store, embedding, generator(action), state.manifest.id, question, options);
  return { calls, state, store, embedding, generator, answer };
}
function claim(context: RagContext) {
  const fact = context.facts[0].fact;
  return { text: fact.statement, factIds: [fact.id], evidenceIds: [...fact.evidenceIds, ...fact.qualifyingEvidenceIds] };
}

test('RAG契约：A1与dense在事实层融合，正常回答附真实来源且不伪造供应商凭证', async () => {
  const f = fixture();
  const prepared = await retrieveRagContext(bundle, f.store, f.embedding, 'contract-index', normalQuestion());
  assert.equal(prepared.status, 'ready');
  const hit = prepared.rankedFacts.find(row => row.fact.id === salt.id);
  assert(hit?.lexicalRank && hit.denseRank, '同一 fact 接收词法与证据映射后的向量排名');
  assert(prepared.rankedFacts.every(row => row.fact.id.startsWith('fact:')));
  const result = await f.answer();
  assert.equal(result.status, 'answered');
  assert.equal(result.executionAllowed, false);
  assert.equal(result.clinicalRelease, null);
  assert.equal(result.invocation, undefined, '离线夹具没有真实调用凭证');
  assert(result.answer?.claims.length);
  for (const item of result.context!.evidence) {
    assert(item.source.url.startsWith('https://'));
    assert.equal(item.source.hash, item.evidence.sourceHash);
    assert.equal(item.source.version, item.evidence.sourceVersion);
    assert(item.evidence.locator.section);
  }
  for (const generated of result.answer!.claims) {
    assert(generated.factIds.every(id => result.context!.facts.some(row => row.fact.id === id)));
    assert(generated.evidenceIds.every(id => result.context!.evidence.some(row => row.evidence.id === id)));
  }
  assert.equal(f.calls.generate, 1);
});

test('RAG契约：成人等条件不从统一评测夹具补入，未知保持待确认且不生成', async () => {
  for (const context of [{}, { adult: 'unknown' }]) {
    const f = fixture(), question = { ...normalQuestion(), context };
    const saved = structuredClone(question);
    const result = await f.answer(question);
    assert.equal(result.status, 'needs_confirmation');
    assert.equal(f.calls.generate, 0);
    assert.deepEqual(question, saved);
    assert.equal(result.answer, undefined);
  }
});

test('RAG契约：歧义、否定疾病与未验证多病组合不进入模型', async () => {
  for (const question of ['糖尿病能吃什么', '香菇能吃吗', '没有高血压，食盐怎样选', '高血压和痛风饮食怎么安排']) {
    const f = fixture();
    const result = await f.answer({ question, context: { adult: 'yes' } });
    assert.equal(result.status, 'needs_confirmation', question);
    assert.equal(f.calls.generate, 0, question);
    assert.equal(result.executionAllowed, false);
  }
});

test('RAG契约：显式 diseaseId 不得隐藏问题中同时出现的其他疾病', async () => {
  const f = fixture();
  const result = await f.answer({ question: '高血压和痛风饮食怎么安排', diseaseId: 'd:hypertension', context: goutContext });
  assert.equal(result.status, 'needs_confirmation');
  assert.equal(f.calls.generate, 0);
  assert.equal(f.calls.embed, 0);
});

test('RAG契约：未命中已支持实体不依靠向量相似度编造已知事实', async () => {
  const f = fixture();
  const result = await f.answer({ question: '火星果xyz怎么吃', context: { adult: 'yes' } });
  assert.equal(result.status, 'insufficient_evidence');
  assert.equal(f.calls.generate, 0);
  assert.equal(f.calls.embed, 0);
});

test('RAG契约：缺失必需证据或其限定证据撤回时零生成调用', async () => {
  const missing = fixture();
  const result = await missing.answer({ ...normalQuestion(), requiredEvidenceIds: ['ev:unknown-required'] });
  assert.equal(result.status, 'insufficient_evidence');
  assert.equal(missing.calls.embed, 0);
  assert.equal(missing.calls.generate, 0);
  const withdrawn = fixture();
  withdrawn.state.revoked.add(juice.qualifyingEvidenceIds[0]);
  const limited = await withdrawn.answer({ question: '痛风 鲜榨果汁', context: goutContext, requiredEvidenceIds: [juice.evidenceIds[0]] });
  assert.equal(limited.status, 'insufficient_evidence');
  assert.equal(withdrawn.calls.generate, 0);
});

test('RAG契约：必需证据的限定闭包不因相关事实未进入top-k而遗漏', async () => {
  const f = fixture();
  f.state.dense = milk.evidenceIds.map(evidenceId => ({ evidenceId, distance: 0 }));
  const result = await retrieveRagContext(bundle, f.store, f.embedding, 'contract-index', {
    question: '痛风 牛奶', context: goutContext, mode: 'dense', requiredEvidenceIds: [juice.evidenceIds[0]],
  }, { maxFacts: 1 });
  assert.equal(result.status, 'ready');
  assert.equal(result.context!.facts.length, 1);
  assert(!result.context!.facts.some(hit => hit.fact.id === juice.id), '此例要求必需证据的事实不占据top-k');
  const ids = new Set(result.context!.evidence.map(item => item.evidence.id));
  assert(ids.has(juice.evidenceIds[0]));
  assert(juice.qualifyingEvidenceIds.every(id => ids.has(id)), '限定/例外证据必须跟随必需支持证据');
});

test('RAG契约：证据预算不足不截断原文或限定条件，不调用生成器', async () => {
  const f = fixture();
  const result = await f.answer(normalQuestion(), undefined, { contextTokens: 1 });
  assert.equal(result.status, 'insufficient_evidence');
  assert.equal(result.reason, 'RAG_EVIDENCE_EXCEEDS_BUDGET');
  assert.equal(f.calls.generate, 0);
  const prepared = await retrieveRagContext(bundle, f.store, f.embedding, 'contract-index', normalQuestion());
  assert.equal(prepared.status, 'ready');
  for (const hit of prepared.context!.facts) {
    const ids = new Set(prepared.context!.evidence.map(row => row.evidence.id));
    assert([...hit.fact.evidenceIds, ...hit.fact.qualifyingEvidenceIds].every(id => ids.has(id)));
  }
  for (const item of prepared.context!.evidence) {
    assert.equal(item.evidence.originalSpan, bundle.evidence.find(e => e.id === item.evidence.id)!.originalSpan);
  }
});

test('RAG契约：索引的知识包ID、hash或证据总数失配均在生成前拒绝', async () => {
  for (const change of [
    (manifest: RagIndexManifest) => { manifest.bundleId = 'different-bundle'; },
    (manifest: RagIndexManifest) => { manifest.bundleHash = 'a'.repeat(64); },
    (manifest: RagIndexManifest) => { manifest.chunks--; },
  ]) {
    const f = fixture(); change(f.state.manifest);
    const result = await f.answer();
    assert.equal(result.status, 'unavailable');
    assert.equal(result.reason, 'RAG_INDEX_BUNDLE_MISMATCH');
    assert.equal(f.calls.embed, 0);
    assert.equal(f.calls.generate, 0);
  }
});

test('RAG契约：同维度但模型/指令不同不能混查，编码途中身份变化也拒绝', async () => {
  const different = fixture();
  different.state.manifest.identity.queryInstruction = 'different retrieval task';
  const result = await different.answer();
  assert.equal(result.reason, 'RAG_EMBEDDING_INDEX_MISMATCH');
  assert.equal(different.calls.embed, 0);
  assert.equal(different.calls.generate, 0);
  const changed = fixture(); changed.state.batchIdentity.revision = 'changed-after-describe';
  const second = await changed.answer();
  assert.equal(second.reason, 'RAG_QUERY_EMBEDDING_INVALID');
  assert.equal(changed.calls.search, 0);
  assert.equal(changed.calls.generate, 0);
});

test('RAG契约：非法引用和未引用回答文本不能发布', async () => {
  const illegal = fixture();
  const result = await illegal.answer(normalQuestion(), context => ({ output: {
    claims: [{ ...claim(context), evidenceIds: ['ev:outside-context'] }], limitations: [],
  } }));
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'RAG_CITATION_OUTSIDE_CONTEXT');
  assert.equal(result.answer, undefined);
  const uncited = fixture();
  const second = await uncited.answer(normalQuestion(), context => ({ output: {
    answer: '这段额外结论没有逐项引用', claims: [claim(context)], limitations: [],
  } }));
  assert.equal(second.reason, 'RAG_UNCITED_ANSWER_TEXT');
  assert.equal(second.answer, undefined);
});

test('RAG契约：模型省略事实必需的限定引用时拒绝', async () => {
  const f = fixture();
  f.state.dense = juice.evidenceIds.map(evidenceId => ({ evidenceId, distance: 0 }));
  const result = await f.answer({ question: '痛风 果糖 鲜榨果汁', context: goutContext, mode: 'dense' }, context => {
    const fact = context.facts.find(hit => hit.fact.qualifyingEvidenceIds.length)!.fact;
    assert(fact.qualifyingEvidenceIds.length);
    return { output: { claims: [{ text: fact.statement, factIds: [fact.id], evidenceIds: [...fact.evidenceIds] }], limitations: [] } };
  });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'RAG_REQUIRED_CITATION_MISSING');
  assert.equal(result.answer, undefined);
});

test('RAG契约：生成失败或超时不重试，也不静默回退普通回答', async () => {
  const f = fixture();
  const result = await f.answer(normalQuestion(), () => { throw Error('RAG_GENERATION_TIMEOUT'); });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'RAG_GENERATION_TIMEOUT');
  assert.equal(result.answer, undefined);
  assert.equal(f.calls.generate, 1);
  assert.equal(f.calls.embed, 1);
  assert.equal(f.calls.search, 1);
});

test('RAG契约：生成前撤回零调用，生成中撤回不发布已返回的文本', async () => {
  const before = fixture();
  before.state.onRevocations = read => { if (read === 2) before.state.revoked.add(bundle.id); };
  const early = await before.answer();
  assert.equal(early.reason, 'RAG_EVIDENCE_CHANGED_BEFORE_GENERATION');
  assert.equal(before.calls.generate, 0);
  const during = fixture();
  const late = await during.answer(normalQuestion(), context => {
    during.state.revoked.add(context.evidence[0].evidence.id);
    return { output: { claims: [claim(context)], limitations: [] } };
  });
  assert.equal(late.reason, 'RAG_EVIDENCE_CHANGED_DURING_GENERATION');
  assert.equal(during.calls.generate, 1);
  assert.equal(late.answer, undefined);
});

test('RAG输出契约：空claims、无fact、无evidence和结构错误不冒充有效引用', async () => {
  const f = fixture();
  const prepared = await retrieveRagContext(bundle, f.store, f.embedding, 'contract-index', normalQuestion());
  assert.equal(prepared.status, 'ready');
  const context = prepared.context!;
  for (const output of [null, [], {}, { claims: [], limitations: [] },
    { claims: [{ ...claim(context), factIds: [] }], limitations: [] },
    { claims: [{ ...claim(context), evidenceIds: [] }], limitations: [] }]) {
    assert.throws(() => validateRagOutput(output, context), /RAG_/);
  }
});

test('RAG条件边界：不能用无条件的食品组成事实绕过所问疾病指南的未知条件', async () => {
  const f = fixture();
  const result = await f.answer({ question: '肥胖时含糖饮料的指南建议适用于我吗？', context: { adult: 'yes', complexComorbidity: 'unknown', pregnantOrLactating: 'unknown' }, mode: 'hybrid' });
  assert.equal(result.status, 'needs_confirmation');
  assert.deepEqual(new Set(result.missingConditions), new Set(['complexComorbidity', 'pregnantOrLactating']));
  assert.equal(f.calls.generate, 0);
});

test('RAG组合边界：明确原发性骨质疏松的简称不能让肾病组合被当成单病', async () => {
  const f = fixture();
  const result = await f.answer({ question: '慢性肾病合并原发性骨质疏松，蛋白质建议能直接合并吗？', context: { adult: 'yes', ckdStage: 'G4', dialysis: 'no', osteoporosisType: 'primary' }, mode: 'hybrid' });
  assert.equal(result.status, 'needs_confirmation');
  assert.equal(f.calls.generate, 0);
});
