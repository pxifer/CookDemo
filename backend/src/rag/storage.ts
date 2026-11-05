import { readFile } from 'node:fs/promises';
import type { Database } from '../db';
import { canonicalKnowledgeHash, sha256, validateKnowledgeBundle } from '../health-knowledge';
import type { KnowledgeBundle } from '../../../shared/health-knowledge';
import type { DenseHit, EmbeddingIdentity, EvidenceVector, RagIndexManifest, RagVectorStore } from './types';

const error = (code: string): never => { throw new Error(code); };
const hashPattern = /^[a-f0-9]{64}$/;
const identityKeys = ['modelId','revision','dimensions','normalization','pooling','queryInstruction','documentInstruction','representationVersion','runtimeVersion'].sort();

/** The entire representation is versioned; same dimensions do not make models interchangeable. */
export function validateEmbeddingIdentity(raw: EmbeddingIdentity): EmbeddingIdentity {
  if (!raw || typeof raw !== 'object' || JSON.stringify(Object.keys(raw).sort()) !== JSON.stringify(identityKeys)) return error('RAG_EMBEDDING_IDENTITY_INVALID');
  if (!Number.isSafeInteger(raw.dimensions) || raw.dimensions < 1 || raw.dimensions > 16000 || raw.normalization !== 'l2') return error('RAG_EMBEDDING_IDENTITY_INVALID');
  for (const name of identityKeys.filter(key => key !== 'dimensions' && key !== 'normalization') as (keyof EmbeddingIdentity)[]) {
    const value = raw[name];
    if (typeof value !== 'string' || value.length > 4000 || value.includes('\0')) return error('RAG_EMBEDDING_IDENTITY_INVALID');
    if (!['queryInstruction','documentInstruction'].includes(name) && !value.trim()) return error('RAG_EMBEDDING_IDENTITY_INVALID');
  }
  return structuredClone(raw);
}

/** pgvector stores float32: quantize before hashing so a fresh connection can verify it. */
export function checkedUnitVector(vector: number[], dimensions: number): number[] {
  if (!Array.isArray(vector) || vector.length !== dimensions || vector.some(value => typeof value !== 'number' || !Number.isFinite(value))) return error('RAG_VECTOR_INVALID');
  const floats = vector.map(Math.fround);
  const norm = Math.sqrt(floats.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0 || Math.abs(norm - 1) > 0.001) return error('RAG_VECTOR_NOT_NORMALIZED');
  return floats;
}

interface StoredManifest {
  id: string; bundle_id: string; bundle_hash: string; identity_hash: string;
  identity: EmbeddingIdentity; dimensions: number; expected_chunks: number;
  payload_hash: string; state: string; created_at: string | Date;
  canonical_hash: string; actual_chunks: number; bundle_chunks: number;
}
interface PreparedRow extends EvidenceVector { vectorHash: string }

function validateRows(bundle: KnowledgeBundle, identity: EmbeddingIdentity, rows: EvidenceVector[]): PreparedRow[] {
  if (!Array.isArray(rows) || rows.length !== bundle.evidence.length || !rows.length) return error('RAG_INDEX_INCOMPLETE');
  const evidence = new Map(bundle.evidence.map(item => [item.id, item]));
  const seen = new Set<string>();
  return rows.map(row => {
    const item = evidence.get(row.evidenceId);
    if (!item || seen.has(row.evidenceId)) return error('RAG_INDEX_EVIDENCE_INVALID');
    seen.add(row.evidenceId);
    if (!hashPattern.test(row.textHash) || row.textHash !== sha256(item.retrievalText)) return error('RAG_INDEX_TEXT_HASH_MISMATCH');
    const vector = checkedUnitVector(row.vector, identity.dimensions);
    return { evidenceId: row.evidenceId, textHash: row.textHash, vector, vectorHash: sha256(JSON.stringify(vector)) };
  }).sort((a, b) => a.evidenceId < b.evidenceId ? -1 : a.evidenceId > b.evidenceId ? 1 : 0);
}

const payloadHash = (rows: PreparedRow[]) => sha256(JSON.stringify(rows.map(row => [row.evidenceId, row.textHash, row.vectorHash])));
const targetsBlocked = (targets: ReadonlySet<string>, values: string[]) => values.some(value => targets.has(value));

export class PgRagVectorStore implements RagVectorStore {
  constructor(private readonly db: Database) {}

  /** Caller must explicitly initialize/import the existing research schema first. */
  async initialize(): Promise<void> {
    await this.db.exec(await readFile(new URL('../health-knowledge/003-evidence-vectors.sql', import.meta.url), 'utf8'));
  }

  async revocations(): Promise<Set<string>> {
    return new Set((await this.db.query<{target_id: string}>('SELECT target_id FROM health_kb.health_revocations')).rows.map(row => row.target_id));
  }

  private async readManifest(db: Database, indexId: string): Promise<StoredManifest> {
    const result = await db.query<StoredManifest>(`SELECT i.*,s.canonical_hash,
      (SELECT count(*)::int FROM health_kb.evidence_embeddings e WHERE e.index_id=i.id) AS actual_chunks,
      (SELECT count(*)::int FROM health_kb.health_evidence_chunks c WHERE c.bundle_id=i.bundle_id) AS bundle_chunks
      FROM health_kb.vector_index_manifests i
      JOIN health_kb.health_bundle_snapshots s ON s.bundle_id=i.bundle_id WHERE i.id=$1`, [indexId]);
    const row = result.rows[0];
    if (!row) return error('RAG_INDEX_NOT_FOUND');
    const identity = validateEmbeddingIdentity(row.identity);
    if (row.state !== 'ready' || row.bundle_hash !== row.canonical_hash || row.identity_hash !== canonicalKnowledgeHash(identity)
      || row.dimensions !== identity.dimensions || row.expected_chunks !== row.actual_chunks || row.expected_chunks !== row.bundle_chunks || row.expected_chunks < 1) return error('RAG_INDEX_CORRUPT');
    return row;
  }

  private publicManifest(row: StoredManifest): RagIndexManifest {
    const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString();
    return { id: row.id, bundleId: row.bundle_id, bundleHash: row.bundle_hash, identity: structuredClone(row.identity), chunks: row.expected_chunks, state: 'ready', createdAt };
  }

  async manifest(indexId: string): Promise<RagIndexManifest> {
    const row = await this.readManifest(this.db, indexId);
    if (targetsBlocked(await this.revocations(), [indexId, row.bundle_id])) return error('RAG_INDEX_WITHDRAWN');
    return this.publicManifest(row);
  }

  async putIndex(indexId: string, rawBundle: KnowledgeBundle, rawIdentity: EmbeddingIdentity, inputRows: EvidenceVector[]): Promise<RagIndexManifest> {
    if (typeof indexId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{1,199}$/.test(indexId)) return error('RAG_INDEX_ID_INVALID');
    const bundle = validateKnowledgeBundle(rawBundle), identity = validateEmbeddingIdentity(rawIdentity);
    const rows = validateRows(bundle, identity, inputRows), bundleHash = canonicalKnowledgeHash(bundle);
    const identityHash = canonicalKnowledgeHash(identity), contentHash = payloadHash(rows);
    const work = async (db: Database) => {
      await db.exec('BEGIN');
      try {
        // Builds are uncommon and small. Serialize publication rather than exposing partial ready rows.
        await db.query('SELECT pg_advisory_xact_lock(1936226167,29)');
        const snapshot = (await db.query<{canonical_hash:string}>('SELECT canonical_hash FROM health_kb.health_bundle_snapshots WHERE bundle_id=$1', [bundle.id])).rows[0];
        if (!snapshot || snapshot.canonical_hash !== bundleHash) return error('RAG_BUNDLE_NOT_IMPORTED_OR_CHANGED');
        const blocked = new Set((await db.query<{target_id:string}>('SELECT target_id FROM health_kb.health_revocations')).rows.map(row => row.target_id));
        if (targetsBlocked(blocked, [indexId, bundle.id])) return error('RAG_INDEX_WITHDRAWN');
        const old = (await db.query<{id:string}>('SELECT id FROM health_kb.vector_index_manifests WHERE id=$1', [indexId])).rows[0];
        if (old) {
          const existing = await this.readManifest(db, indexId);
          if (existing.bundle_id !== bundle.id || existing.bundle_hash !== bundleHash || existing.identity_hash !== identityHash || existing.payload_hash !== contentHash) return error('RAG_INDEX_IMMUTABLE_USE_NEW_ID');
          const result = this.publicManifest(existing);
          await db.exec('COMMIT');
          return result;
        }
        await db.query(`INSERT INTO health_kb.vector_index_manifests
          (id,bundle_id,bundle_hash,identity_hash,identity,dimensions,expected_chunks,payload_hash,state)
          VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,'ready')`, [indexId,bundle.id,bundleHash,identityHash,JSON.stringify(identity),identity.dimensions,rows.length,contentHash]);
        for (const row of rows) await db.query(`INSERT INTO health_kb.evidence_embeddings
          (index_id,bundle_id,evidence_id,dimensions,text_hash,vector_hash,embedding)
          VALUES($1,$2,$3,$4,$5,$6,$7::vector)`, [indexId,bundle.id,row.evidenceId,identity.dimensions,row.textHash,row.vectorHash,JSON.stringify(row.vector)]);
        const result = this.publicManifest(await this.readManifest(db, indexId));
        await db.exec('COMMIT');
        return result;
      } catch (cause) {
        await db.exec('ROLLBACK');
        throw cause;
      }
    };
    return this.db.withSession ? this.db.withSession(work) : work(this.db);
  }

  async search(indexId: string, input: number[], limit: number): Promise<DenseHit[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) return error('RAG_SEARCH_LIMIT_INVALID');
    const manifest = await this.manifest(indexId), vector = checkedUnitVector(input, manifest.identity.dimensions);
    const rows = (await this.db.query<{evidence_id:string;distance:number;source_id:string;source_version:string;source_hash:string}>(`SELECT e.evidence_id,
      (e.embedding <=> $2::vector) AS distance,c.source_id,c.source_version,c.source_hash
      FROM health_kb.evidence_embeddings e
      JOIN health_kb.health_evidence_chunks c ON c.bundle_id=e.bundle_id AND c.id=e.evidence_id
      JOIN health_kb.health_documents d ON d.bundle_id=c.bundle_id AND d.id=c.source_id
        AND d.version=c.source_version AND d.source_hash=c.source_hash
      WHERE e.index_id=$1 AND c.state='active' AND d.state='active'
      AND NOT EXISTS(SELECT 1 FROM health_kb.health_revocations r WHERE r.target_id IN
        (e.index_id,e.bundle_id,e.evidence_id,c.source_id,c.source_id||'@'||c.source_version,c.source_hash))
      ORDER BY distance,e.evidence_id LIMIT $3`, [indexId,JSON.stringify(vector),limit])).rows;
    // A revocation committed while the distance query was running must not leak into the result.
    const latest = await this.revocations();
    if (targetsBlocked(latest, [indexId, manifest.bundleId])) return error('RAG_INDEX_WITHDRAWN');
    return rows.filter(row => !targetsBlocked(latest, [row.evidence_id,row.source_id,`${row.source_id}@${row.source_version}`,row.source_hash])).map(row => {
      const distance = Number(row.distance);
      if (!Number.isFinite(distance) || distance < -0.000001 || distance > 2.000001) return error('RAG_DISTANCE_INVALID');
      return { evidenceId: row.evidence_id, distance: Math.max(0, Math.min(2, distance)) };
    });
  }
}
