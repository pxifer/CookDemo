import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { readConfig } from '../backend/src/config';
import { migrate, type Database } from '../backend/src/db';
import { inspectDatabase } from '../backend/src/deployment';
import { createApp } from '../backend/src/app';

const stage = () => ({ APP_ENV: 'staging', APP_ORIGIN: 'https://shiwei.example', DATABASE_URL: 'postgresql://owner:test@127.0.0.1/shiwei_test',
  SESSION_SECRET_B64: randomBytes(32).toString('base64'), CSRF_SECRET_B64: randomBytes(32).toString('base64') });
async function embedded() {
  const engine = new PGlite();
  const db: Database = { query: (sql, params) => engine.query(sql, params), exec: async sql => { await engine.exec(sql); }, close: () => engine.close() };
  return db;
}
test('部署配置：生产入口拒绝测试身份、构造数据、缺密钥及不可信来源', () => {
  const local = readConfig({}); assert.equal(local.host, '127.0.0.1'); assert.equal(local.contentSource, 'constructed');
  assert.equal(readConfig(stage()).contentSource, 'pending');
  for (const change of [{ LOCAL_TEST_FEATURES: '1' }, { CONTENT_SOURCE: 'constructed' }, { SESSION_SECRET_B64: '' },
    { APP_ORIGIN: 'http://shiwei.example' }, { APP_ORIGIN: 'https://shiwei.example/' }, { PORT: 'NaN' }, { DB_POOL_MAX: '0' },
    { SEMANTIC_SEARCH_ENABLED: '1' }, { ACCOUNTS_ENABLED: '1' }, { MODEL_ENABLED: 'true' }]) {
    assert.throws(() => readConfig({ ...stage(), ...change }), /配置/);
  }
  assert.throws(() => readConfig({ HOST: '0.0.0.0', LOCAL_TEST_FEATURES: '1' }), /LOCAL_TEST_FEATURES/);
  const same = stage(); same.CSRF_SECRET_B64 = same.SESSION_SECRET_B64; assert.throws(() => readConfig(same), /CSRF_SECRET/);
  const localDatabase = {APP_ENV:'local',CONTENT_SOURCE:'database',DATABASE_URL:'postgresql://app:test@127.0.0.1/fixture',CONTENT_RELEASE_ID:'local-business-v1'};
  assert.equal(readConfig(localDatabase).contentSource,'database');
  assert.throws(() => readConfig({...localDatabase,CONTENT_RELEASE_ID:''}),/CONTENT_RELEASE_ID/);
  assert.throws(() => readConfig({...stage(),CONTENT_SOURCE:'database',CONTENT_RELEASE_ID:'local-business-v1'}),/CONTENT_SOURCE/);
});
test('配置失败不回显连接串、密码或不可读取的秘密文件路径', () => {
  const value = 'postgresql://user:should-never-be-printed@remote.example/db?sslmode=disable';
  try { readConfig({ ...stage(), DATABASE_URL: value }); assert.fail(); }
  catch (error) { assert(!String(error).includes('should-never')); assert(!String(error).includes('remote.example')); }
  assert.throws(() => readConfig({ ...stage(), DATABASE_URL_FILE: 'private-do-not-echo' }), /DATABASE_URL/);
  assert.throws(() => readConfig({ SESSION_SECRET_B64_FILE: 'private-do-not-echo' }), error => !String(error).includes('private-do-not-echo'));
});
test('版本迁移可重复、保留既有数据、漂移拒绝；空表不等于正式内容', async () => {
  const db = await embedded();
  try {
    assert.deepEqual(await migrate(db), [1, 2]);
    await db.query("INSERT INTO accounts(id,issuer,external_subject) VALUES('00000000-0000-0000-0000-000000000001','test','retained')");
    assert.deepEqual(await migrate(db), []);
    assert.equal((await db.query('SELECT * FROM accounts')).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM catalog_recipes')).rows.length, 0);
    assert.deepEqual(await inspectDatabase(db), { available: true, core: true, vector: false, ready: true });
    assert.equal((await inspectDatabase(db, true)).ready, false);
    await db.query("UPDATE schema_migrations SET checksum='changed' WHERE version=2");
    await assert.rejects(migrate(db), /MIGRATION_CHANGED_2/);
  } finally { await db.close(); }
});
test('历史001需显式接管，建表失败整体回滚；非法配料关系不进入结构', async () => {
  const db = await embedded();
  try {
    await db.exec('CREATE TABLE schema_migrations(version integer PRIMARY KEY,installed_at timestamptz DEFAULT now()); INSERT INTO schema_migrations(version) VALUES(1);');
    await assert.rejects(migrate(db), /LEGACY_SCHEMA_REQUIRES_ADOPTION/);
    assert.deepEqual(await migrate(db, { adoptLegacy: true }), [1, 2]);
    await assert.rejects(db.query("INSERT INTO catalog_variants(release_id,id,recipe_id,flavor) VALUES('missing','v','r','plain')"));
    await assert.rejects(db.query("INSERT INTO content_sources(id,version,kind,title,state) VALUES('s','v','recipe','s','approved')"));
    assert.equal((await db.query('SELECT * FROM catalog_variants')).rows.length, 0);
  } finally { await db.close(); }
  const failed = await embedded();
  try {
    await failed.exec('CREATE TABLE catalog_foods(dummy integer);');
    await assert.rejects(migrate(failed));
    const { rows } = await failed.query<{ relation: string | null }>("SELECT to_regclass('public.accounts')::text AS relation");
    assert.equal(rows[0].relation, null);
  } finally { await failed.close(); }
});
test('部署探针区分结构/正式开放；待录入环境不回退构造菜谱', async () => {
  const db = await embedded(); await migrate(db);
  const app = await createApp({ database: db, environment: 'staging', contentSource: 'pending', origin: 'https://shiwei.example' });
  try {
    assert.equal((await app.inject('/healthz')).statusCode, 200);
    assert.equal((await app.inject('/deploymentz')).statusCode, 200);
    const ready = await app.inject('/readyz'); assert.equal(ready.statusCode, 503); assert.equal(ready.json().status, 'content_pending');
    const catalog = await app.inject('/api/v1/catalog/recipes'); assert.equal(catalog.statusCode, 503); assert(!catalog.body.includes('番茄炒蛋'));
    assert.equal((await app.inject('/api/v1/auth/session')).json().accountAvailable, false);
    await db.exec('DROP TABLE catalog_variant_steps');
    assert.equal((await app.inject('/deploymentz')).statusCode, 503);
  } finally { await app.close(); await db.close(); }
});
test('数据库故障返回503且不泄露上游错误；会话签名可跨实例验证', async () => {
  const db: Database = { query: async () => { throw new Error('postgresql://secret@hidden-host/db'); }, exec: async () => {}, close: async () => {} };
  const broken = await createApp({ database: db, environment: 'staging', contentSource: 'pending' });
  try { const res = await broken.inject('/deploymentz'); assert.equal(res.statusCode, 503); assert(!res.body.includes('hidden-host')); } finally { await broken.close(); }
  const sessionSecret = randomBytes(32), csrfSecret = randomBytes(32);
  const a = await createApp({ sessionSecret, csrfSecret }), b = await createApp({ sessionSecret, csrfSecret });
  try {
    const session = await a.inject('/api/v1/auth/session');
    const cookie = session.headers['set-cookie']!.toString().split(';')[0];
    const res = await b.inject({ method: 'POST', url: '/api/v1/recognitions/text', payload: { text: '鸡蛋' },
      headers: { cookie, origin: 'http://localhost:80', 'x-csrf-token': session.json().csrfToken } });
    assert.equal(res.statusCode, 200);
  } finally { await a.close(); await b.close(); }
});
