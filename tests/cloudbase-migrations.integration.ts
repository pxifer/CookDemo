import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildCloudbaseMigration } from '../scripts/build-cloudbase-migrations';

test('CloudBase atomic migrations close inherited default grants, preserve checksums, and reject collisions', {
  skip: process.env.RUN_DOCKER_CLOUDBASE_TESTS !== '1', timeout: 60000,
}, async () => {
  const candidates = [
    process.env.DOCKER_EXE,
    join(process.env.LOCALAPPDATA ?? '', 'Programs/DockerDesktop/resources/bin/docker.exe'),
    'C:/Program Files/Docker/Docker/resources/bin/docker.exe',
  ];
  const docker = candidates.find(path => path && existsSync(path));
  assert.ok(docker, 'Docker Desktop CLI is required');
  function run(args: string[], input?: string) {
    const result = spawnSync(docker!, args, { input, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    return result.stdout.trim();
  }
  const context = run(['context', 'show']);
  const endpoint = run(['context', 'inspect', context, '--format', '{{.Endpoints.docker.Host}}']);
  assert.match(endpoint, /^(npipe|unix):\/\//, 'Only a local Docker context is allowed');
  assert.equal(run(['inspect', 'shiwei-local-db-1', '--format', '{{index .Config.Labels "com.docker.compose.project"}}']), 'shiwei-local');
  const suffix = randomUUID().replace(/-/g, '');
  const database = `shiwei_cloudcheck_${suffix}`;
  const owner = `shiwei_cm_${suffix}`;
  const clients = ['guest', 'user', 'service'].map(kind => `shiwei_${kind}_${suffix}`);
  assert.match(database, /^shiwei_cloudcheck_[a-f0-9]+$/);
  const psql = (db: string, sql: string) => run(['exec', '-i', 'shiwei-local-db-1', 'psql', '-X', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-f', '-'], sql);
  let created = false;
  const core = await buildCloudbaseMigration('core', { database, owner, clientRoles: clients });
  const vector = await buildCloudbaseMigration('vector', { database, owner, clientRoles: clients });
  const vectorProbe = await readFile(new URL('../deploy/db/cloudbase-vector-probe.sql', import.meta.url), 'utf8');
  try {
    psql('postgres', `CREATE DATABASE ${database};`);
    created = true;
    const result = psql(database, `BEGIN;
      CREATE ROLE ${owner} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
      ${clients.map(role => `CREATE ROLE ${role} NOLOGIN NOSUPERUSER;`).join('\n')}
      ALTER ROLE ${clients[2]} BYPASSRLS;
      GRANT USAGE,CREATE ON SCHEMA public TO ${owner};
      ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT ALL ON TABLES TO ${clients.join(',')};
      ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT ALL ON SEQUENCES TO ${clients.join(',')};
      SET ROLE ${owner};
      DO $collision$
      BEGIN
        BEGIN
          CREATE TABLE public.accounts (untracked text);
          EXECUTE $core_collision$${core}$core_collision$;
          RAISE EXCEPTION 'UNTRACKED_TABLE_NOT_REJECTED';
        EXCEPTION WHEN raise_exception THEN
          IF SQLERRM <> 'CLOUDBASE_UNTRACKED_PROJECT_TABLES' THEN RAISE; END IF;
        END;
      END $collision$;
      ${core}
      ${core}
      DO $checksum$
      BEGIN
        BEGIN
          UPDATE public.schema_migrations SET checksum='changed' WHERE version=1;
          EXECUTE $core_tampered$${core}$core_tampered$;
          RAISE EXCEPTION 'CHANGED_CHECKSUM_NOT_REJECTED';
        EXCEPTION WHEN raise_exception THEN
          IF SQLERRM <> 'MIGRATION_CHANGED_1' THEN RAISE; END IF;
        END;
      END $checksum$;
      RESET ROLE;
      CREATE SCHEMA extensions;
      CREATE EXTENSION vector WITH SCHEMA extensions;
      GRANT USAGE ON SCHEMA extensions TO ${owner};
      SET ROLE ${owner};
      ${vector}
      ${vector}
      ${core}
      ${vectorProbe}
      SELECT 'probe_fixture_rows=' || count(*) FROM public.content_sources;
      INSERT INTO public.accounts(id,issuer,external_subject) VALUES('00000000-0000-4000-8000-000000000001','constructed','fixture');
      GRANT SELECT ON public.accounts TO ${clients[0]};
      SET ROLE ${clients[0]};
      SELECT 'rls_visible_rows=' || count(*) FROM public.accounts;
      RESET ROLE;
      SET ROLE ${owner};
      REVOKE SELECT ON public.accounts FROM ${clients[0]};
      SELECT 'migration_versions=' || string_agg(version::text,',' ORDER BY version) FROM public.schema_migrations;
      SELECT 'project_tables=' || count(*) FROM pg_tables WHERE schemaname='public';
      SELECT 'unprotected_tables=' || count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity;
      SELECT 'guest_can_select=' || has_table_privilege('${clients[0]}','public.accounts','SELECT');
      SELECT 'guest_can_use_sequence=' || has_sequence_privilege('${clients[0]}',pg_get_serial_sequence('public.revocations','sequence'),'USAGE,SELECT,UPDATE');
      ROLLBACK;`);
    assert.match(result, /rls_visible_rows=0/);
    assert.match(result, /migration_versions=1,2,3/);
    assert.match(result, /probe_fixture_rows=0/);
    assert.match(result, /project_tables=26/);
    assert.match(result, /unprotected_tables=0/);
    assert.match(result, /guest_can_select=false/);
    assert.match(result, /guest_can_use_sequence=false/);
    console.log('Verified atomic core/vector migrations, repeat runs, checksum/collision rejection, and client grant/RLS denial on real PG.');
  } finally {
    // This database name was generated and created successfully by this test only.
    if (created) psql('postgres', `DROP DATABASE ${database};`);
  }
});
