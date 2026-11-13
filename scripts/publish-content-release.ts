import { readFile, readdir, writeFile } from 'node:fs/promises';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

/** Publish a prepared content package to the existing CloudBase environment.
 *
 * Two steps, in this order, because reversing them takes the whole site to 503:
 *   1. insert the content release row (idempotent, old rows untouched)
 *   2. deploy the function that points at the new row
 *
 * The content row is ~5MB, which no OS command line can carry and which the migration
 * API rejects once the accumulated history passes 10MiB. So the statement is handed to
 * the official CLI in-process; the network call, endpoint and credentials are the same
 * as `tcb db execute`.
 *
 * It refuses to run while the environment allows overrun billing unless the operator
 * passes --accept-overrun, and it re-reads the published row before touching the function.
 */
const args = new Map<string, string>();
const flags = new Set<string>();
for (let index = 2; index < process.argv.length; index++) {
  const item = process.argv[index]!;
  if (!item.startsWith('--')) continue;
  const next = process.argv[index + 1];
  if (next && !next.startsWith('--')) { args.set(item.slice(2), next); index++; } else flags.add(item.slice(2));
}
if (!args.get('package')) throw new Error('USAGE: --package <releaseDir> [--accept-overrun] [--content-only|--function-only]');
const packageDir = resolve(args.get('package')!);
const environmentId = 'shiwei-d2gmiun66b7dc6a4f';
const region = 'ap-shanghai';
const functionName = 'shiwei-http-preview';
const cliRoot = resolve('.local-data/tooling/cloudbase-cli/node_modules/@cloudbase/cli');
const cliEntry = join(cliRoot, 'bin', 'tcb');
const cliMain = join(cliRoot, 'dist/standalone/cli.js');
const node = process.execPath;

const manifest = JSON.parse(await readFile(join(packageDir, 'manifest.json'), 'utf8'));
const config = JSON.parse(await readFile(join(packageDir, 'cloudbaserc.json'), 'utf8'));
const settings = config.functions?.[0]?.envVariables ?? {};
if (settings.CONTENT_BUNDLE_ID !== manifest.contentReleased || settings.CONTENT_BUNDLE_SHA256 !== manifest.contentHash) throw new Error('PACKAGE_CONTENT_MISMATCH');
if (!/^[a-f0-9]{64}$/.test(manifest.contentHash ?? '')) throw new Error('PACKAGE_HASH_INVALID');

function parse(text: string, label: string): any {
  const start = text.indexOf('{');
  if (start < 0) throw new Error(`${label}_RESPONSE_UNRECOGNIZED`);
  const parsed = JSON.parse(text.slice(start, text.lastIndexOf('}') + 1));
  if (parsed.error) throw new Error(`${label}_FAILED:${parsed.error.code}`);
  return parsed.data;
}

/** Normal CLI call; arguments fit comfortably on the command line. */
function runCli(cloudArgs: string[], cwd?: string): any {
  const result = spawnSync(node, [cliEntry, ...cloudArgs, '--json'], { encoding: 'utf8', cwd, env: { ...process.env, TCB_NO_BROWSER: 'true' } });
  return parse((result.stdout ?? '') + (result.stderr ?? ''), 'CLI');
}

/** Same CLI command, but the SQL stays in a temp script file instead of argv:
 * a 5MB statement is far beyond the OS command line limit. */
function executeLarge(sql: string): any {
  const argv = [node, 'tcb', 'db', 'execute', '-e', environmentId, '--region', region, '--role', 'cloudbase_postgres', '--sql', sql, '--json'];
  const script = `process.argv=${JSON.stringify(argv)};require(${JSON.stringify(cliMain)});`;
  const file = join(tmpdir(), `shiwei-publish-${randomUUID()}.cjs`);
  writeFileSync(file, script, { mode: 0o600 });
  try {
    const result = spawnSync(node, [file], { encoding: 'utf8', env: { ...process.env, TCB_NO_BROWSER: 'true' } });
    return parse((result.stdout ?? '') + (result.stderr ?? ''), 'EXECUTE');
  } finally {
    unlinkSync(file);
  }
}

const environments = runCli(['env', 'list', '--region', region]);
const target = (environments ?? []).find((item: any) => item.EnvId === environmentId);
if (!target) throw new Error('ENVIRONMENT_NOT_FOUND');
if (target.Status !== 'NORMAL' || target.IsAutoRenew !== false) throw new Error('ENVIRONMENT_STATE_UNEXPECTED');
if (target.EnableOverrun === true && !flags.has('accept-overrun')) {
  throw new Error(`OVER_BILLING_ENABLED(PackageId=${target.PackageId}); pass --accept-overrun to proceed`);
}

if (!flags.has('function-only')) {
  const migrationDir = join(packageDir, 'migration', 'cloudbase', 'migrations');
  const files = (await readdir(migrationDir)).filter(name => name.endsWith('.sql')).sort();
  if (!files.length) throw new Error('MIGRATION_FILE_MISSING');
  // Fetched history may sit next to the new file; the newest version is this release.
  const sql = (await readFile(join(migrationDir, files[files.length - 1]!), 'utf8')).replace(/^--[^\n]*\n/, '');
  if (!sql.includes(manifest.contentReleased) || !sql.includes(manifest.contentHash)) throw new Error('MIGRATION_CONTENT_MISMATCH');
  executeLarge(sql);
  const check = executeLarge(`SELECT release_id, checksum, published FROM public.shiwei_gallery_releases WHERE release_id='${manifest.contentReleased}';`);
  const rows = (check.Rows ?? []).map((row: any) => (typeof row === 'string' ? JSON.parse(row) : row));
  const row = rows.find((item: any) => (Array.isArray(item) ? item[0] : item?.release_id) === manifest.contentReleased);
  const checksum = Array.isArray(row) ? row[1] : row?.checksum;
  const published = Array.isArray(row) ? row[2] : row?.published;
  // The HTTP API returns every cell as text, so `published` arrives as "true".
  if (!row || checksum !== manifest.contentHash || String(published) !== 'true') throw new Error('CONTENT_ROW_NOT_PUBLISHED');
}

if (!flags.has('content-only')) {
  const deployed = runCli(['fn', 'deploy', functionName, '--httpFn', '--force', '--install-dependency', 'false', '--runtime', 'Nodejs24.11', '-e', environmentId, '--region', region, '--yes'], packageDir);
  const ok = (deployed?.results ?? []).some((item: any) => item.name === functionName && item.status === 'success');
  if (!ok) throw new Error('FUNCTION_DEPLOY_UNCONFIRMED');
}

await writeFile(join(packageDir, 'publish-result.json'), JSON.stringify({
  at: new Date().toISOString(), contentReleased: manifest.contentReleased, contentHash: manifest.contentHash,
  compiledEntrySha256: manifest.compiledEntrySha256, environmentId,
  contentOnly: flags.has('content-only'), functionOnly: flags.has('function-only'),
}, null, 2));
console.log(JSON.stringify({ published: true, content: manifest.contentReleased, hash: manifest.contentHash, environmentId }));
