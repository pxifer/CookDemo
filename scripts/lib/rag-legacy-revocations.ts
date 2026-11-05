import { existsSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { HealthKnowledgeRepository } from '../../backend/src/health-knowledge-repository';

/** Carry authoritative old research withdrawals into the derived PG store; never clear either set. */
export async function synchronizeLegacyRagRevocations(repository: HealthKnowledgeRepository) {
  const directory = '.local-data/health-knowledge/shared';
  if (!existsSync(directory)) return { legacyStorePresent: false, revocations: 0 };
  const legacy = new PGlite(directory);
  try {
    const rows = (await legacy.query<{ target_id: string; reason: string }>('SELECT target_id,reason FROM health_kb.health_revocations ORDER BY target_id')).rows;
    for (const row of rows) {
      if (typeof row.target_id !== 'string' || row.target_id.length > 300 || typeof row.reason !== 'string') throw Error('RAG_LEGACY_REVOCATIONS_INVALID');
      await repository.withdraw(row.target_id, row.reason);
    }
    return { legacyStorePresent: true, revocations: rows.length };
  } finally { await legacy.close(); }
}
