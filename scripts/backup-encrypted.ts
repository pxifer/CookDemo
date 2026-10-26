import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { requiredCoreTables } from '../server/deployment';
import { migrationFiles } from '../server/migrations';
import { decryptBackup, encryptBackup, sha256File, type BackupMetadata } from './lib/backup-archive';

// Deliberately not a real-data/cloud recovery tool. It cannot back up business rows.
async function main() {
  const verify = process.argv.includes('--verify-restore');
  const archiveArguments = process.argv.slice(2).filter(arg => arg.startsWith('--archive='));
  if (archiveArguments.length > 1 || process.argv.slice(2).some(arg => arg !== '--verify-restore' && !arg.startsWith('--archive='))) throw new Error('BACKUP_ARGUMENT_INVALID');
  const existingArchive = archiveArguments[0]?.slice('--archive='.length);
  if (archiveArguments.length && !existingArchive) throw new Error('BACKUP_ARGUMENT_INVALID');
  if (process.platform !== 'win32' || process.env.SHIWEI_BACKUP_ACL_READY !== '1') throw new Error('BACKUP_REQUIRES_WINDOWS_ACL_WRAPPER');
  const docker = [process.env.DOCKER_EXE, join(process.env.LOCALAPPDATA ?? '', 'Programs/DockerDesktop/resources/bin/docker.exe'),
    'C:/Program Files/Docker/Docker/resources/bin/docker.exe'].find(path => path && existsSync(path));
  if (!docker) throw new Error('BACKUP_DOCKER_UNAVAILABLE');
  function run(args: string[], input?: string) {
    const result = spawnSync(docker!, args, { input, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024, windowsHide: true });
    if (result.status !== 0) throw new Error('BACKUP_DOCKER_COMMAND_FAILED');
    return result.stdout.trim();
  }
  const context = run(['context','show']);
  if (!/^(npipe|unix):\/\//.test(run(['context','inspect',context,'--format','{{.Endpoints.docker.Host}}']))) throw new Error('BACKUP_REMOTE_DOCKER_REJECTED');
  const container = 'shiwei-local-db-1';
  if (run(['inspect',container,'--format','{{index .Config.Labels "com.docker.compose.project"}}']) !== 'shiwei-local') throw new Error('BACKUP_CONTAINER_MISMATCH');
  const sql = (database: string, query: string) => run(['exec','-i',container,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-A','-t','-f','-'], query);
  const projectTables = [...requiredCoreTables, 'embedding_indexes','recipe_variant_embeddings'];
  const emptyCheck = projectTables.map(table => `(SELECT count(*) FROM public.${table})`).join('+');
  if (!existingArchive && sql('shiwei_dev', `SELECT ${emptyCheck};`) !== '0') throw new Error('BACKUP_REQUIRES_EMPTY_PROJECT_TABLES');
  const migrations = await Promise.all(migrationFiles.map(async file => ({ version: file.version, filename: file.name,
    checksum: createHash('sha256').update((await readFile(new URL(`../server/migrations/${file.name}`, import.meta.url), 'utf8')).replace(/\r\n/g,'\n')).digest('hex') })));
  if (!existingArchive) {
    const remote = JSON.parse(sql('shiwei_dev', `SELECT json_agg(t ORDER BY version) FROM (SELECT version,filename,checksum FROM public.schema_migrations) t;`));
    if (JSON.stringify(remote) !== JSON.stringify(migrations)) throw new Error('BACKUP_MIGRATION_MISMATCH');
  }
  const keys = resolve('.local-data/backup-keys'), archives = resolve('.local-data/encrypted-backups'), work = resolve('.local-data/restore-work');
  for (const directory of [keys, archives, work]) await mkdir(directory, { recursive: true, mode: 0o700 });
  const keyFile = join(keys, 'local-structure-v1.b64');
  if (!existingArchive) try {
    const file = await open(keyFile, 'wx', 0o600);
    try { await file.writeFile(randomBytes(32).toString('base64')); } finally { await file.close(); }
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new Error('BACKUP_KEY_CREATE_FAILED'); }
  const encodedKey = (await readFile(keyFile, 'utf8')).trim(), key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encodedKey) throw new Error('BACKUP_KEY_INVALID_EXISTING_FILE_PRESERVED');
  const id = randomUUID().replace(/-/g,''), createdAt = new Date().toISOString();
  let destination = join(archives, `shiwei-empty-${createdAt.slice(0,10)}-${id}.swbk`);
  if (existingArchive) {
    const requested = resolve(existingArchive);
    if ((await lstat(requested)).isSymbolicLink() || dirname(await realpath(requested)).toLowerCase() !== (await realpath(archives)).toLowerCase() ||
        !/^shiwei-empty-\d{4}-\d\d-\d\d-[a-f0-9]{32}\.swbk$/.test(basename(requested))) throw new Error('BACKUP_ARCHIVE_OUTSIDE_MANAGED_DIRECTORY');
    destination = requested;
  }
  const temporaryDump = join(work, `${id}.dump`), temporaryList = join(work, `${id}.list`);
  const containerDump = `/tmp/shiwei-encrypted-${id}.dump`, containerList = `/tmp/shiwei-encrypted-${id}.list`;
  const restoreDatabase = `shiwei_enc_restore_${id}`;
  let databaseCreated = false, archiveCreated = false;
  async function restore(expected?: BackupMetadata) {
    const authenticated = await decryptBackup(destination, temporaryDump, key);
    if ((expected && JSON.stringify(authenticated) !== JSON.stringify(expected)) || authenticated.database !== 'shiwei_dev' ||
        JSON.stringify(authenticated.migrationChecksums) !== JSON.stringify(migrations.map(file => file.checksum))) throw new Error('BACKUP_AUTHENTICATED_METADATA_MISMATCH');
    run(['cp',temporaryDump,`${container}:${containerDump}`]);
    run(['exec',container,'createdb','-U','postgres','-T','template0',restoreDatabase]); databaseCreated = true;
    sql(restoreDatabase, 'CREATE EXTENSION vector;');
    const list = run(['exec',container,'pg_restore','--list',containerDump]);
    await writeFile(temporaryList, list.split(/\r?\n/).filter(line => !/^\d+;.*\sSCHEMA - public\s/.test(line)).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
    run(['cp',temporaryList,`${container}:${containerList}`]);
    run(['exec',container,'pg_restore','-U','postgres','-d',restoreDatabase,'--no-owner','--no-privileges','--exit-on-error','--use-list',containerList,containerDump]);
    // Schema-only dumps exclude ledger rows. Rebuild exactly the authenticated, source-checked ledger.
    sql(restoreDatabase, `INSERT INTO public.schema_migrations(version,filename,checksum) VALUES ${migrations.map(file => `(${file.version},'${file.filename}','${file.checksum}')`).join(',')};`);
    const count = Number(sql(restoreDatabase, "SELECT count(*) FROM pg_tables WHERE schemaname='public';"));
    if (count !== 26 || sql(restoreDatabase, `SELECT ${emptyCheck};`) !== '0' ||
        sql(restoreDatabase, 'SELECT count(*) FROM public.schema_migrations WHERE checksum IS NOT NULL;') !== '3') throw new Error('BACKUP_RESTORE_STRUCTURE_MISMATCH');
    return authenticated;
  }
  try {
    if (existingArchive) {
      const authenticated = await restore();
      const receipt = { ...authenticated, archiveSha256: await sha256File(destination), bytes: (await stat(destination)).size,
        checkedAt: createdAt, restoreChecked: true, restoredTables: 26, migrations: 3, businessRows: 0,
        isolatedRestoreOnly: true, cloudBackup: false, fullRecoveryAccepted: false, ledgerRestoredFromAuthenticatedMetadata: true };
      await writeFile(`${destination}.restore-${id}.json`, JSON.stringify(receipt,null,2) + '\n', { flag: 'wx', mode: 0o600 });
      console.log(JSON.stringify(receipt,null,2));
      return;
    }
    const dump = spawn(docker, ['exec',container,'pg_dump','-U','postgres','-d','shiwei_dev','-Fc','--schema-only','--no-owner','--no-privileges','-n','public'],
      { stdio: ['ignore','pipe','pipe'], windowsHide: true });
    dump.stderr.resume();
    const exit = new Promise<number>(resolveExit => { dump.on('error', () => resolveExit(-1)); dump.on('close', code => resolveExit(code ?? -1)); });
    const source = Readable.from((async function* () {
      for await (const chunk of dump.stdout) yield chunk;
      if (await exit !== 0) throw new Error('BACKUP_EXPORT_FAILED');
    })());
    const metadata: BackupMetadata = { scope: 'local-empty-structure', format: 'pg_dump-custom', database: 'shiwei_dev', createdAt,
      migrationChecksums: migrations.map(file => file.checksum) };
    let sealed;
    try { sealed = await encryptBackup(source, destination, key, metadata); archiveCreated = true; }
    finally { if (dump.exitCode === null) dump.kill(); await exit; }
    const receipt = { ...sealed, schemaOnly: true, cloudBackup: false, fullRecoveryAccepted: false,
      restoreChecked: false, restoredTables: 0, migrations: migrations.length, businessRows: 0,
      ledgerRestoredFromAuthenticatedMetadata: false, automaticScheduleConfigured: false, retentionRotationConfigured: false };
    if (verify) {
      await restore(metadata);
      receipt.restoreChecked = true; receipt.restoredTables = 26; receipt.ledgerRestoredFromAuthenticatedMetadata = true;
    }
    await writeFile(`${destination}.json`, JSON.stringify(receipt,null,2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ ...receipt, archive: destination, keyDirectory: keys }, null, 2));
  } catch (error) {
    if (archiveCreated) await unlink(destination);
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    try { if (databaseCreated) run(['exec',container,'dropdb','-U','postgres',restoreDatabase]); }
    catch { cleanupFailures.push('database'); }
    try { run(['exec',container,'rm','-f',containerDump,containerList]); }
    catch { cleanupFailures.push('container-files'); }
    for (const path of [temporaryDump, temporaryList]) {
      try { await unlink(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') cleanupFailures.push('local-file'); }
    }
    key.fill(0);
    if (cleanupFailures.length) throw new Error('BACKUP_CLEANUP_FAILED');
  }
}
main().catch(error => { console.error(/^BACKUP_[A-Z_]+$/.test(error?.message) ? error.message : 'BACKUP_FAILED'); process.exitCode = 1; });
