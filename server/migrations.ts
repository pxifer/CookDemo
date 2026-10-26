import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Database } from './db';

export const CORE_SCHEMA_VERSION = 2;
export const migrationFiles = [
  { version: 1, name: '001-initial.sql', vector: false },
  { version: 2, name: '002-content-structure.sql', vector: false },
  { version: 3, name: '003-vector-structure.sql', vector: true },
];
export async function runMigrations(db: Database, options: { vector?: boolean; adoptLegacy?: boolean } = {}) {
  const run = async (session: Database) => {
    const applied: number[] = [];
    await session.exec('BEGIN');
    try {
      // Real pg sessions serialize the entire migration. Embedded tests have one executor.
      if (db.withSession) await session.query('SELECT pg_advisory_xact_lock(1936226167, 1)');
      await session.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version integer PRIMARY KEY, installed_at timestamptz NOT NULL DEFAULT now());
        ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS filename text;
        ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text;`);
      const { rows } = await session.query<{ version: number; filename: string | null; checksum: string | null }>('SELECT version,filename,checksum FROM schema_migrations ORDER BY version');
      if (rows.some(row => !migrationFiles.some(file => file.version === row.version))) throw new Error('SCHEMA_NEWER_THAN_CODE');
      for (const file of migrationFiles.filter(f => !f.vector || options.vector || rows.some(r => r.version === f.version))) {
        const raw = await readFile(new URL(`./migrations/${file.name}`, import.meta.url), 'utf8');
        const source = raw.replace(/\r\n/g, '\n');
        const checksum = createHash('sha256').update(source).digest('hex');
        const installed = rows.find(row => row.version === file.version);
        if (installed?.checksum) {
          if (installed.checksum !== checksum || installed.filename !== file.name) throw new Error(`MIGRATION_CHANGED_${file.version}`);
          continue;
        }
        if (installed && (!options.adoptLegacy || file.version !== 1)) throw new Error('LEGACY_SCHEMA_REQUIRES_ADOPTION');
        // Legacy 001 was transactional itself. One pinned outer transaction now owns all files.
        const sql = source.replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '');
        await session.exec(sql);
        await session.query(`INSERT INTO schema_migrations(version,filename,checksum) VALUES($1,$2,$3)
          ON CONFLICT(version) DO UPDATE SET filename=EXCLUDED.filename,checksum=EXCLUDED.checksum`, [file.version, file.name, checksum]);
        applied.push(file.version);
      }
      await session.exec('COMMIT');
      return applied;
    } catch (error) {
      await session.exec('ROLLBACK');
      throw error;
    }
  };
  return db.withSession ? db.withSession(run) : run(db);
}
