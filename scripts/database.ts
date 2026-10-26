import { readConfig, ConfigurationError } from '../server/config';
import { connectDatabase, migrate, type Database } from '../server/db';
import { inspectDatabase } from '../server/deployment';

const args = process.argv.slice(2), command = args.shift();
let db: Database | undefined;
try {
  if (!['migrate','check'].includes(command ?? '') || args.some(a => !['--vector','--adopt-legacy'].includes(a))) throw new ConfigurationError('DATABASE_COMMAND');
  const config = readConfig();
  if (!config.databaseUrl) throw new ConfigurationError('DATABASE_URL');
  db = await connectDatabase(config.databaseUrl, { ...config.database, max: 1, queryTimeoutMs: 30000 });
  if (command === 'migrate') {
    const versions = await migrate(db, { vector: args.includes('--vector'), adoptLegacy: args.includes('--adopt-legacy') });
    console.log(JSON.stringify({ action: 'migrate', appliedVersions: versions }));
  }
  const status = await inspectDatabase(db, config.requireVector || args.includes('--vector'));
  console.log(JSON.stringify({ action: 'check', ...status }));
  if (!status.ready) process.exitCode = 1;
} catch (error) {
  const code = error instanceof Error && /^(MIGRATION_CHANGED_\d+|SCHEMA_NEWER_THAN_CODE|LEGACY_SCHEMA_REQUIRES_ADOPTION)$/.test(error.message) ? error.message : 'DATABASE_OPERATION_FAILED';
  console.error(error instanceof ConfigurationError ? error.message : code);
  process.exitCode = 1;
} finally { await db?.close(); }
