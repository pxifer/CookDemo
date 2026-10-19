import { readFile } from 'node:fs/promises';
import pg from 'pg';
export interface Database {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}
export async function connectDatabase(url: string): Promise<Database> {
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  return { query: async <T>(sql: string, params?: unknown[]) => {
    const result = await pool.query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount };
  }, exec: async sql => { await pool.query(sql); }, close: () => pool.end() };
}
export async function migrate(db: Database) {
  await db.exec(await readFile(new URL('./migrations/001-initial.sql', import.meta.url), 'utf8'));
}
