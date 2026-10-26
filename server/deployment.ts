import type { Database } from './db';
import { CORE_SCHEMA_VERSION } from './migrations';

export const requiredCoreTables = [
  'accounts', 'profiles', 'favorites', 'credentials', 'operations', 'quota', 'erasures',
  'public_releases', 'revocations', 'content_sources', 'catalog_releases', 'catalog_release_sources',
  'catalog_foods', 'catalog_food_aliases', 'catalog_food_relations', 'catalog_nutrition',
  'catalog_recipes', 'catalog_variants', 'catalog_variant_lines', 'catalog_variant_steps',
  'catalog_search_documents', 'app_sessions', 'user_consents',
];
export async function inspectDatabase(db: Database, requireVector = false) {
  try {
    await db.query('SELECT 1');
    const { rows } = await db.query<{ version: number; checksum: string | null }>('SELECT version,checksum FROM schema_migrations ORDER BY version');
    const schema = [1, CORE_SCHEMA_VERSION].every(version => rows.some(row => row.version === version && row.checksum));
    const { rows: tables } = await db.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    const names = new Set(tables.map(t => t.tablename));
    const core = schema && requiredCoreTables.every(name => names.has(name));
    const vector = rows.some(row => row.version === 3 && row.checksum) && names.has('embedding_indexes') && names.has('recipe_variant_embeddings')
      && (await db.query("SELECT 1 FROM pg_extension WHERE extname='vector'")).rows.length > 0;
    return { available: true, core, vector, ready: core && (!requireVector || vector) };
  } catch {
    // Neither driver errors nor connection details belong in public probes.
    return { available: false, core: false, vector: false, ready: false };
  }
}
