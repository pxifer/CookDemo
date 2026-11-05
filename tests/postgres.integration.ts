// Explicit opt-in; never runs against the application or production database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { connectDatabase, migrate } from '../backend/src/db';
import { ProfileRepository } from '../backend/src/repository';
import { InvocationLedger, type Invocation } from '../backend/src/gateway';
import { inspectDatabase } from '../backend/src/deployment';
import { assertLocalTestDatabase } from '../scripts/lib/local-test-config';

const enabled = process.env.RUN_POSTGRES_TESTS === '1';
test('真实PostgreSQL：并行迁移、跨连接CAS/预算竞争、向量维度约束', { skip: !enabled }, async () => {
  const url = process.env.TEST_DATABASE_URL_FILE ? readFileSync(process.env.TEST_DATABASE_URL_FILE, 'utf8').trim() : process.env.TEST_DATABASE_URL;
  assert(url && new URL(url).pathname === '/shiwei_test_structure', '只允许独立 shiwei_test_structure 构造测试库');
  assertLocalTestDatabase(url,true);
  const db = await connectDatabase(url, { max: 4 });
  const id = randomUUID(), release = `test-${id}`, source = `source-${id}`;
  try {
    await Promise.all([migrate(db, { vector: true }), migrate(db, { vector: true })]);
    assert.equal((await inspectDatabase(db, true)).ready, true);
    await db.query("INSERT INTO accounts(id,issuer,external_subject) VALUES($1,'synthetic',$2)", [id,id]);
    const repo = new ProfileRepository(db, randomBytes(32));
    await repo.save(id, 0, { constructed: true });
    const writes = await Promise.allSettled([repo.save(id, 1, { constructed: 'a' }), repo.save(id, 1, { constructed: 'b' })]);
    assert.equal(writes.filter(r => r.status === 'fulfilled').length, 1);
    const ledger = new InvocationLedger(db, randomBytes(32));
    const call: Invocation = { subject: id, operationId: id, input: 'synthetic', feeMode: 'platform_free', providerModel: 'fixture', credentialVersion: null };
    await db.query('INSERT INTO quota(bucket,maximum) VALUES($1,1)', [id]); await ledger.admit(call);
    const claims = await Promise.all(Array.from({ length: 4 }, () => ledger.claim(call, id)));
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal((await db.query<{ used: number }>('SELECT used FROM quota WHERE bucket=$1', [id])).rows[0].used, 1);
    await db.query("INSERT INTO content_sources(id,version,kind,title) VALUES($1,'test','recipe','synthetic')", [source]);
    await db.query("INSERT INTO public_releases(id,content_hash,manifest) VALUES($1,'synthetic','{}')", [release]);
    await db.query('INSERT INTO catalog_releases(id) VALUES($1)', [release]);
    await db.query("INSERT INTO catalog_release_sources VALUES($1,$2,'test')", [release,source]);
    await db.query("INSERT INTO catalog_recipes(release_id,id,name,category,home_style,minutes,source_id,source_version) VALUES($1,'r','synthetic','veg',true,1,$2,'test')", [release,source]);
    await db.query("INSERT INTO catalog_variants(release_id,id,recipe_id,flavor) VALUES($1,'v','r','test')", [release]);
    await db.query("INSERT INTO embedding_indexes(id,release_id,model_id,model_revision,dimensions,distance_metric,representation_version,normalization) VALUES($1,$1,'synthetic','fixture',3,'cosine','v1','l2')", [release]);
    await assert.rejects(db.query("INSERT INTO recipe_variant_embeddings VALUES($1,$1,'v',3,'h','[1,2]'::vector)", [release]));
    await db.query("INSERT INTO recipe_variant_embeddings VALUES($1,$1,'v',3,'h','[1,2,3]'::vector)", [release]);
  } finally {
    for (const table of ['recipe_variant_embeddings','embedding_indexes','catalog_variants','catalog_recipes','catalog_release_sources']) await db.query(`DELETE FROM ${table} WHERE ${table === 'embedding_indexes' ? 'id' : 'release_id'}=$1`, [release]);
    await db.query('DELETE FROM catalog_releases WHERE id=$1', [release]); await db.query('DELETE FROM public_releases WHERE id=$1', [release]);
    await db.query('DELETE FROM content_sources WHERE id=$1', [source]); await db.query('DELETE FROM accounts WHERE id=$1', [id]);
    await db.query('DELETE FROM operations WHERE subject=$1', [id]); await db.query('DELETE FROM quota WHERE bucket=$1', [id]);
    await db.close();
  }
});
