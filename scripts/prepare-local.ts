import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dir = resolve('.local-data/deployment');
await mkdir(dir, { recursive: true, mode: 0o700 });
async function keep(name: string, value: string) {
  const path = resolve(dir, name);
  try { const file = await open(path, 'wx', 0o600); try { await file.writeFile(value, 'utf8'); } finally { await file.close(); } }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  return readFile(path, 'utf8');
}
for (const name of ['db-admin-password','db-owner-password','db-app-password']) {
  const value = await keep(name, randomBytes(32).toString('base64url'));
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error(`本地密码文件格式异常：${name}；未覆盖已有文件`);
}
for (const name of ['session-secret','csrf-secret']) {
  const value = await keep(name, randomBytes(32).toString('base64'));
  if (Buffer.from(value, 'base64').length !== 32) throw new Error('本地密钥文件格式异常；未覆盖已有文件');
}
for (const [role, name] of [['shiwei_owner','owner'], ['shiwei_app','app']]) {
  const password = (await readFile(resolve(dir, `db-${name}-password`), 'utf8')).trim();
  await keep(`db-${name}-url`, `postgresql://${role}:${password}@127.0.0.1:5432/shiwei_dev`);
}
const common = 'APP_ENV=local\nHOST=127.0.0.1\nPORT=4175\nAPP_ORIGIN=http://127.0.0.1:4175\nLOCAL_TEST_FEATURES=0\nCONTENT_SOURCE=constructed\n';
await keep('local.env', common + 'DATABASE_URL_FILE=.local-data/deployment/db-app-url\nSESSION_SECRET_B64_FILE=.local-data/deployment/session-secret\nCSRF_SECRET_B64_FILE=.local-data/deployment/csrf-secret\n');
await keep('migration.env', common + 'DATABASE_URL_FILE=.local-data/deployment/db-owner-url\n');
const ownerPassword = (await readFile(resolve(dir, 'db-owner-password'), 'utf8')).trim();
await keep('db-test-url', `postgresql://shiwei_owner:${ownerPassword}@127.0.0.1:5432/shiwei_test_structure`);
await keep('postgres-test.env', 'RUN_POSTGRES_TESTS=1\nTEST_DATABASE_URL_FILE=.local-data/deployment/db-test-url\n');
console.log('本地配置已准备（已有文件保持不变），位于 .local-data/deployment；未打印密码，未启动数据库或接入模型。');
