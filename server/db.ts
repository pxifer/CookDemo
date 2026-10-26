import pg from 'pg';
import type { PoolClient } from 'pg';
export interface Database {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  withSession?<T>(work: (db: Database) => Promise<T>): Promise<T>;
}
export interface DatabaseOptions { max?: number; connectTimeoutMs?: number; queryTimeoutMs?: number; ca?: string }
export async function connectDatabase(url: string, options: DatabaseOptions = {}): Promise<Database> {
  const parsed = new URL(url), mode = parsed.searchParams.get('sslmode');
  if (mode === 'verify-full' && !options.ca) throw new Error('DATABASE_CA_REQUIRED');
  if (options.ca) for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) parsed.searchParams.delete(key);
  const pool = new pg.Pool({ connectionString: parsed.toString(), max: options.max ?? 4,
    connectionTimeoutMillis: options.connectTimeoutMs ?? 5000, query_timeout: options.queryTimeoutMs ?? 5000,
    ...(options.ca ? { ssl: { ca: options.ca, rejectUnauthorized: true } } : {}) });
  // Idle client failures must not print connection strings or crash through an unhandled event.
  pool.on('error', () => {});
  const bound = (client?: PoolClient): Database => ({ query: async <T>(sql: string, params?: unknown[]) => {
    const result = await (client ?? pool).query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount };
  }, exec: async sql => { await (client ?? pool).query(sql); }, close: () => client ? Promise.resolve() : pool.end(),
    withSession: async work => {
      if (client) return work(bound(client));
      const session = await pool.connect();
      try { return await work(bound(session)); } finally { session.release(); }
    },
  });
  return bound();
}
export async function migrate(db: Database, options: { vector?: boolean; adoptLegacy?: boolean } = {}) {
  const { runMigrations } = await import('./migrations');
  return runMigrations(db, options);
}
