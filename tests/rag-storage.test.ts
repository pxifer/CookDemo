import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { connectDatabase, type Database } from '../backend/src/db';
import { HealthKnowledgeRepository } from '../backend/src/health-knowledge-repository';
import { sha256, validateKnowledgeBundle } from '../backend/src/health-knowledge';
import { checkedUnitVector, PgRagVectorStore, validateEmbeddingIdentity } from '../backend/src/rag/storage';
import type { EmbeddingIdentity, EvidenceVector } from '../backend/src/rag/types';

const bundle = validateKnowledgeBundle(JSON.parse(await readFile(new URL('../datasets/health/2026-10-28-v2/knowledge-bundle.json', import.meta.url), 'utf8')));
const bundleManifest = JSON.parse(await readFile(new URL('../datasets/health/2026-10-28-v2/manifest.json', import.meta.url), 'utf8'));
const identity: EmbeddingIdentity = {
  modelId: 'synthetic-storage-test', revision: 'fixture-v1', dimensions: 2,
  normalization: 'l2', pooling: 'test', queryInstruction: '', documentInstruction: '',
  representationVersion: 'retrieval-text-v1', runtimeVersion: 'synthetic-not-a-model',
};
const vectors = (): EvidenceVector[] => bundle.evidence.map((e, index) => ({ evidenceId: e.id, textHash: sha256(e.retrievalText), vector: index === 0 ? [1, 0] : [0, 1] }));

test('向量身份和数值校验拒绝未知字段、维数错误、零向量、NaN及未归一化值', () => {
  assert.deepEqual(validateEmbeddingIdentity(identity), identity);
  assert.notEqual(validateEmbeddingIdentity(identity), identity);
  assert.throws(() => validateEmbeddingIdentity({ ...identity, extra: 'unversioned' } as EmbeddingIdentity), /IDENTITY_INVALID/);
  assert.throws(() => validateEmbeddingIdentity({ ...identity, dimensions: 0 }), /IDENTITY_INVALID/);
  assert.throws(() => validateEmbeddingIdentity({ ...identity, revision: '' }), /IDENTITY_INVALID/);
  for (const vector of [[0, 0], [1, 1], [Infinity, 0], [NaN, 0], [1], [1e300, 0]]) {
    assert.throws(() => checkedUnitVector(vector, 2), /RAG_VECTOR/);
  }
  assert.deepEqual(checkedUnitVector([1, 0], 2), [1, 0]);
});

test('缺失/重复证据、错误文本hash和向量维数在访问数据库前拒绝', async () => {
  let queries = 0;
  const db: Database = { query: async () => { queries++; throw Error('database should not be used'); }, exec: async () => { queries++; }, close: async () => {} };
  const store = new PgRagVectorStore(db);
  await assert.rejects(store.putIndex('invalid-index', bundle, identity, vectors().slice(1)), /RAG_INDEX_INCOMPLETE/);
  const duplicate = vectors(); duplicate[1] = duplicate[0];
  await assert.rejects(store.putIndex('invalid-index', bundle, identity, duplicate), /RAG_INDEX_EVIDENCE_INVALID/);
  const tampered = vectors(); tampered[0].textHash = 'a'.repeat(64);
  await assert.rejects(store.putIndex('invalid-index', bundle, identity, tampered), /RAG_INDEX_TEXT_HASH_MISMATCH/);
  const dimensions = vectors(); dimensions[0].vector = [1, 0, 0];
  await assert.rejects(store.putIndex('invalid-index', bundle, identity, dimensions), /RAG_VECTOR_INVALID/);
  assert.equal(queries, 0);
});

test('未导入知识包不允许发布索引，并回滚事务', async () => {
  const events: string[] = [];
  const db: Database = {
    query: async <T>(sql: string) => { events.push(sql); return { rows: [] as T[] }; },
    exec: async sql => { events.push(sql); }, close: async () => {},
  };
  await assert.rejects(new PgRagVectorStore(db).putIndex('missing-bundle-index', bundle, identity, vectors()), /RAG_BUNDLE_NOT_IMPORTED_OR_CHANGED/);
  assert.equal(events[0], 'BEGIN');
  assert.equal(events.at(-1), 'ROLLBACK');
  assert(!events.some(sql => sql.startsWith('INSERT')));
});

test('真实PG/pgvector存储：原子完整入库、不可变幂等、换连接持久回读与撤回', {
  skip: !process.env.RAG_TEST_DATABASE_URL_FILE,
  timeout: 90000,
}, async () => {
  // Explicit disposable database only; never accept the normal business or research database.
  const value = (await readFile(process.env.RAG_TEST_DATABASE_URL_FILE!, 'utf8')).trim();
  const url = new URL(value);
  assert(['postgres:', 'postgresql:'].includes(url.protocol));
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /^\/shiwei_rag_test_[a-z0-9_]+$/);
  assert(!url.searchParams.has('host') && !url.searchParams.has('hostaddr'));
  let db = await connectDatabase(value, { max: 1 });
  const indexId = 'storage-test-' + randomUUID();
  try {
    const repository = new HealthKnowledgeRepository(db);
    await repository.initializeResearchSchema();
    await repository.importResearch(bundle, bundleManifest);
    let store = new PgRagVectorStore(db);
    await store.initialize();
    const manifest = await store.putIndex(indexId, bundle, identity, vectors());
    assert.equal(manifest.chunks, bundle.evidence.length);
    assert.equal(manifest.state, 'ready');
    assert.deepEqual((await store.search(indexId, [1, 0], 1)).map(row => row.evidenceId), [bundle.evidence[0].id]);
    assert.equal((await store.putIndex(indexId, bundle, identity, vectors())).id, indexId);
    await assert.rejects(store.putIndex(indexId, bundle, { ...identity, modelId: 'different-model-same-dimensions' }, vectors()), /RAG_INDEX_IMMUTABLE/);
    const changed = vectors(); changed[0].vector = [0, 1];
    await assert.rejects(store.putIndex(indexId, bundle, identity, changed), /RAG_INDEX_IMMUTABLE/);
    await assert.rejects(db.query('UPDATE health_kb.evidence_embeddings SET text_hash=$1 WHERE index_id=$2', ['b'.repeat(64), indexId]), /HEALTH_RESEARCH_IMMUTABLE/);
    await db.close();
    db = await connectDatabase(value, { max: 1 });
    store = new PgRagVectorStore(db);
    assert.deepEqual((await store.manifest(indexId)).identity, identity);
    assert.equal((await store.search(indexId, [1, 0], 1))[0].evidenceId, bundle.evidence[0].id);
    const first = bundle.evidence[0];
    await new HealthKnowledgeRepository(db).withdraw(first.sourceId, 'synthetic storage revocation in disposable test database');
    const blocked = new Set(bundle.evidence.filter(e => e.sourceId === first.sourceId).map(e => e.id));
    assert((await store.search(indexId, [1, 0], bundle.evidence.length)).every(row => !blocked.has(row.evidenceId)));
    await new HealthKnowledgeRepository(db).withdraw(indexId, 'synthetic index withdrawal');
    await assert.rejects(store.manifest(indexId), /RAG_INDEX_WITHDRAWN/);
    await assert.rejects(store.search(indexId, [1, 0], 1), /RAG_INDEX_WITHDRAWN/);
    assert.equal(bundle.boundaries.embeddingBuilt, false, 'frozen source bundle remains unchanged');
  } finally { await db.close(); }
});
