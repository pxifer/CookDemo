import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { migrate, type Database } from '../backend/src/db';
import { open, seal } from '../backend/src/crypto';
import { ProfileRepository } from '../backend/src/repository';
import { InvocationLedger, type Invocation } from '../backend/src/gateway';
import { ErasureProcessor, restoreCanOpen } from '../backend/src/erasure';

async function database() {
  const pg = new PGlite();
  const db: Database = { query: (sql, params) => pg.query(sql, params), exec: async sql => { await pg.exec(sql); }, close: () => pg.close() };
  await migrate(db); return db;
}
test('V-09: AES-GCM绑定用户、用途、版本，防改密文与随机nonce', () => {
  const key = randomBytes(32), value = { allergy: 'constructed-secret' };
  const a = seal(value, key, 'A', 'profile', 'v1'), b = seal(value, key, 'A', 'profile', 'v1');
  assert.notEqual(a.nonce, b.nonce); assert(!JSON.stringify(a).includes(value.allergy));
  assert.deepEqual(open(a, key, 'A', 'profile'), value);
  assert.throws(() => open(a, key, 'B', 'profile')); assert.throws(() => open(a, key, 'A', 'credential'));
  assert.throws(() => open({ ...a, keyVersion: 'v2' }, key, 'A', 'profile'));
  assert.throws(() => open({ ...a, tag: randomBytes(16).toString('base64') }, key, 'A', 'profile'));
});
test('V-05: PostgreSQL迁移、版本冲突、用户隔离、加密存储、禁用后迟到写入', async () => {
  const db = await database();
  try {
    await migrate(db); const a = randomUUID(), b = randomUUID();
    await db.query("INSERT INTO accounts(id,issuer,external_subject) VALUES($1,'test','a'),($2,'test','b')", [a, b]);
    const repo = new ProfileRepository(db, randomBytes(32));
    await repo.save(a, 0, { allergy: 'constructed-egg' }); assert.equal(await repo.load(b), null);
    const results = await Promise.allSettled([repo.save(a, 1, { allergy: 'first' }), repo.save(a, 1, { allergy: 'second' })]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal((await repo.load(a))?.version, 2);
    const raw = await db.query('SELECT envelope FROM profiles'); assert(!JSON.stringify(raw.rows).includes('allergy'));
    await db.query('UPDATE accounts SET disabled=true WHERE id=$1', [a]);
    assert.equal(await repo.load(a), null); await assert.rejects(repo.save(a, 2, { allergy: 'late' }), /禁用|变化/);
  } finally { await db.close(); }
});
test('AR-M05 / V-03: 同操作不可变、原子认领、全局额度、共享两次预算与未知状态', async () => {
  const db = await database();
  try {
    const key = randomBytes(32), one = new InvocationLedger(db, key), two = new InvocationLedger(db, key);
    await db.query("INSERT INTO quota(bucket,maximum) VALUES('platform',10)");
    const call: Invocation = { subject: 'guest-test', operationId: 'operation-1', input: { text: 'synthetic' }, feeMode: 'platform_free', providerModel: 'test-model', credentialVersion: null };
    assert.equal(await one.admit(call), 'admitted');
    await assert.rejects(two.admit({ ...call, input: { text: 'changed' } }), /不能变更/);
    await assert.rejects(two.admit({ ...call, feeMode: 'byok', credentialVersion: 'new-key' }), /不能变更/);
    const claimed = await Promise.all([one.claim(call, 'platform'), two.claim(call, 'platform')]); assert.equal(claimed.filter(Boolean).length, 1);
    await one.settle(call, 'failed', true); assert.equal(await two.claim(call, 'platform'), true);
    await two.settle(call, 'failed', true); assert.equal(await one.claim(call, 'platform'), false);
    const row = await db.query<{ attempts: number; state: string }>('SELECT attempts,state FROM operations WHERE operation_id=$1', [call.operationId]);
    assert.equal(row.rows[0].attempts, 2); assert.equal(row.rows[0].state, 'failed');
    const byok = { ...call, operationId: 'byok-1', feeMode: 'byok' as const, credentialVersion: 'v1' };
    await one.admit(byok); assert(await one.claim(byok, 'platform')); await one.settle(byok, 'unknown', true);
    assert.equal(await two.admit(byok), 'unknown'); assert.equal(await two.claim(byok, 'platform'), false);
    const usage = await db.query<{ used: number }>("SELECT used FROM quota WHERE bucket='platform'"); assert.equal(usage.rows[0].used, 3);
    assert(!JSON.stringify((await db.query('SELECT * FROM operations')).rows).includes('synthetic'));
  } finally { await db.close(); }
});
test('AR-M05: 多主体共享平台额度；BYOK失败没有自动补救', async () => {
  const db = await database();
  try {
    await db.query("INSERT INTO quota(bucket,maximum) VALUES('global',1)");
    const ledger = new InvocationLedger(db, randomBytes(32));
    const a: Invocation = { subject: 'a', operationId: 'op-a', input: 'x', feeMode: 'byok', credentialVersion: 'v1', providerModel: 'test' }, b = { ...a, subject: 'b', operationId: 'op-b' };
    await ledger.admit(a); await ledger.admit(b);
    assert(await ledger.claim(a, 'global')); assert.equal(await ledger.claim(b, 'global'), false);
    await ledger.settle(a, 'failed', true); assert.equal(await ledger.admit(a), 'failed'); assert.equal(await ledger.claim(a, 'global'), false);
  } finally { await db.close(); }
});
test('AR-M06: 清除意图持久、身份即时禁用、故障后续办、未知撤销覆盖拒绝开放恢复', async () => {
  const db = await database();
  try {
    const id = randomUUID(); await db.query("INSERT INTO accounts(id,issuer,external_subject) VALUES($1,'test','delete-me')", [id]);
    const repo = new ProfileRepository(db, randomBytes(32)); await repo.save(id, 0, { constructed: true });
    let failAuth = true; const journal = new Set<string>();
    const dependencies = { recordRevocation: async (taskId: string) => { journal.add(taskId); }, deleteIdentity: async () => { if (failAuth) throw new Error('injected identity outage'); } };
    const processor = new ErasureProcessor(db, dependencies); const taskId = await processor.request(id, 'account');
    assert.equal(await repo.load(id), null); await assert.rejects(processor.advance(taskId), /injected/);
    assert.equal((await db.query<{ state: string }>('SELECT state FROM erasures WHERE id=$1', [taskId])).rows[0].state, 'processing');
    failAuth = false; const restarted = new ErasureProcessor(db, dependencies); await restarted.advance(taskId); await restarted.advance(taskId);
    assert.equal((await db.query('SELECT * FROM profiles')).rows.length, 0);
    assert.equal((await db.query<{ state: string }>('SELECT state FROM erasures WHERE id=$1', [taskId])).rows[0].state, 'completed'); assert(journal.has(taskId));
    const evidence = { independentJournalVerified: true, latestHeadVerified: true, requiredWatermark: 10, appliedWatermark: 10, identitiesVerified: true, keysVerified: true };
    assert(restoreCanOpen(evidence)); assert.equal(restoreCanOpen({ ...evidence, latestHeadVerified: false }), false);
    assert.equal(restoreCanOpen({ ...evidence, appliedWatermark: 9 }), false);
  } finally { await db.close(); }
});
