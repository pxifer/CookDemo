import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { assertLocalTestDatabase } from './lib/local-test-config';
import { dockerExecutable, probeDocker } from './lib/acceptance-environment';

async function main() {
  const executable = dockerExecutable();
  if (!executable || probeDocker().state !== 'available') throw Error('RAG_LOCAL_DOCKER_REQUIRED');
  const ownerUrl = (await readFile('.local-data/deployment/db-owner-url', 'utf8')).trim();
  assertLocalTestDatabase(ownerUrl);
  const original = new URL(ownerUrl), owner = decodeURIComponent(original.username);
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(owner)) throw Error('RAG_OWNER_IDENTIFIER_INVALID');
  const testName = 'shiwei_rag_test_' + new Date().toISOString().replace(/[^0-9]/g, '');
  const databases = [{ name: 'shiwei_rag_research', file: 'database-url' }, { name: testName, file: 'test-database-url' }];
  const query = (database: string, sql: string) => execFileSync(executable, ['exec', 'shiwei-local-db-1', 'psql', '-U', 'postgres', '-d', database, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  await mkdir('.local-data/rag', { recursive: true });
  for (const target of databases) {
    if (!/^shiwei_rag_[a-z0-9_]+$/.test(target.name)) throw Error('RAG_DATABASE_NAME_REJECTED');
    const existing = query('postgres', `SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='${target.name}'`);
    if (existing && existing !== owner) throw Error('RAG_DATABASE_OWNER_MISMATCH');
    if (!existing) query('postgres', `CREATE DATABASE "${target.name}" OWNER "${owner}"`);
    query(target.name, 'CREATE EXTENSION IF NOT EXISTS vector');
    const url = new URL(original); url.pathname = '/' + target.name;
    await writeFile(join('.local-data/rag', target.file), url.toString(), { mode: 0o600 });
  }
  console.log(JSON.stringify({ localOnly: true, researchDatabase: 'shiwei_rag_research', testDatabase: testName, existingVolumeRetained: true, secretsPrinted: false }));
}
main().catch(() => { console.error('RAG_LOCAL_PREPARATION_FAILED: require the existing healthy local Docker database and owner configuration; no credentials printed'); process.exitCode = 1; });
