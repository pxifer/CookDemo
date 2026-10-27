import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createHealthModel, readHealthModelConfig, type HealthModelConfig } from '../server/health-model';
import { InvocationLedger } from '../server/gateway';
import { migrate, type Database } from '../server/db';
import { createApp } from '../server/app';
import { mealWith, request } from './fixtures';

const config: HealthModelConfig = { provider: 'zhipu', model: 'glm-4.7-flash', apiKey: 'test-secret-never-return', timeoutMs: 500, quotaBucket: 'health-test' };
const plan = { diseases: [{ input: '测试疾病', canonical: null }], evidenceQueries: ['测试疾病 成分 食材 烹调条件 证据'] };
const response = (value: unknown = plan, finish = 'stop') => Response.json({ choices: [{ finish_reason: finish, message: { content: JSON.stringify(value) } }] });
const input = () => ({ subject: 'test-user', operationId: crypto.randomUUID(), mealVersion: 1, diseases: ['测试疾病'], signal: new AbortController().signal });

test('模型配置默认无调用，只接收明确开关、固定免费型号及服务端密钥；错误不包含秘密', () => {
  assert.equal(readHealthModelConfig({}), undefined);
  assert.equal(readHealthModelConfig({ MODEL_ENABLED: '0', MODEL_API_KEY: config.apiKey }), undefined);
  const enabled = { MODEL_ENABLED: '1', MODEL_PROVIDER: 'zhipu', MODEL_NAME: 'glm-4.7-flash', MODEL_API_KEY: config.apiKey };
  assert.equal(readHealthModelConfig(enabled)?.model, 'glm-4.7-flash');
  for (const change of [{ MODEL_ENABLED: 'true' }, { MODEL_NAME: 'paid-model' }, { MODEL_PROVIDER: 'other' },
    { MODEL_BASE_URL: 'http://untrusted.example' }, { MODEL_API_KEY: '' }, { MODEL_TIMEOUT_MS: '0' },
    { MODEL_API_KEY_FILE: 'missing-private-secret' }, { MODEL_QUOTA_BUCKET: 'a b' }]) {
    assert.throws(() => readHealthModelConfig({ ...enabled, ...change }), error => /配置/.test(String(error)) && !String(error).includes(config.apiKey) && !String(error).includes('missing-private-secret'));
  }
});

test('真实PostgreSQL语法调用账本：原子认领、零自动重试、超时、输出核验和额度保留', async t => {
  const engine = new PGlite();
  const db: Database = { query: (sql, params) => engine.query(sql, params), exec: async sql => { await engine.exec(sql); }, close: () => engine.close() };
  await migrate(db);
  await db.query('INSERT INTO quota(bucket,maximum) VALUES($1,50)', [config.quotaBucket]);
  const ledger = new InvocationLedger(db, randomBytes(32));
  try {
    await t.test('仅发送疾病名；成功仍需证据，不输出健康菜谱；重复操作不重新调用', async () => {
      let calls = 0;
      const model = createHealthModel(config, ledger, async (url, init) => {
        calls++; assert.equal(url, 'https://open.bigmodel.cn/api/paas/v4/chat/completions');
        assert.equal(init?.redirect, 'error'); assert.equal((init?.headers as any).Authorization, `Bearer ${config.apiKey}`);
        const body = JSON.parse(init!.body as string);
        assert.equal(body.model, config.model); assert.equal(body.thinking.type, 'disabled');
        assert.deepEqual(JSON.parse(body.messages[1].content), { diseases: ['测试疾病'] });
        return response();
      });
      const call = input(); const result = await model.prepare(call);
      assert.equal(result.state, 'evidence_required'); assert.deepEqual(result.plan, plan);
      await assert.rejects(model.prepare(call), /已提交/); assert.equal(calls, 1);
      await assert.rejects(model.prepare({ ...call, diseases: ['另一疾病'] }), /同一操作标识/);
      const stored = JSON.stringify((await db.query('SELECT * FROM operations')).rows);
      assert(!stored.includes('测试疾病')); assert(!stored.includes(config.apiKey));
    });
    await t.test('并发重复操作只认领一次', async () => {
      let calls = 0;
      const model = createHealthModel(config, ledger, async () => { calls++; return response(); });
      const call = input(), results = await Promise.allSettled([model.prepare(call), model.prepare(call)]);
      assert.equal(calls, 1); assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    });
    await t.test('拒绝错名、额外字段、截断、非法JSON和巨大正文，均不补救', async () => {
      for (const make of [() => response({ ...plan, diseases: [{ input: '错误', canonical: null }] }),
        () => response({ ...plan, safe: true }), () => response(plan, 'length'),
        () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'not json' } }] }),
        () => new Response('x'.repeat(65537))]) {
        let calls = 0;
        const model = createHealthModel(config, ledger, async () => { calls++; return make(); });
        await assert.rejects(model.prepare(input())); assert.equal(calls, 1);
      }
    });
    await t.test('上游错误不泄露正文/凭证，不重试', async () => {
      for (const status of [401, 403, 429, 500]) {
        let calls = 0;
        const model = createHealthModel(config, ledger, async () => { calls++; return new Response(config.apiKey, { status }); });
        await assert.rejects(model.prepare(input()), error => !String(error).includes(config.apiKey)); assert.equal(calls, 1);
      }
    });
    await t.test('超时与主动取消传播至请求，结果未知保留额度', async () => {
      const slowFetch: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
        const signal = init!.signal!;
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
      const model = createHealthModel({ ...config, timeoutMs: 30 }, ledger, slowFetch);
      const call = input(); await assert.rejects(model.prepare(call), /超时/);
      const row = (await db.query<{ state: string; attempts: number }>('SELECT state,attempts FROM operations WHERE subject=$1 AND operation_id=$2', [call.subject, `health:${call.operationId}`])).rows[0];
      assert.equal(row.state, 'unknown'); assert.equal(row.attempts, 1);
      const controller = new AbortController();
      const pending = createHealthModel(config, ledger, slowFetch).prepare({ ...input(), signal: controller.signal });
      setTimeout(() => controller.abort(), 20);
      await assert.rejects(pending, /取消/);
    });
    await t.test('额度不足与空疾病不发送请求', async () => {
      let calls = 0;
      const model = createHealthModel({ ...config, quotaBucket: 'missing' }, ledger, async () => { calls++; return response(); });
      await assert.rejects(model.prepare(input()), /额度/);
      await assert.rejects(model.prepare({ ...input(), diseases: [] }), /疾病/); assert.equal(calls, 0);
    });
  } finally { await db.close(); }
});

test('健康模式实际进入模型适配；游客/CSRF/未确认限制拦截，普通模式零调用', async () => {
  let calls = 0;
  const app = await createApp({ localTestFeatures: true, healthModel: { prepare: async data => {
    calls++; assert.deepEqual(data.diseases, ['测试疾病']); return { state: 'evidence_required', message: '健康证据尚未接通', plan };
  } } });
  try {
    const session = await app.inject('/api/v1/auth/session'); assert.equal(session.json().healthModelAvailable, true);
    const guest = String(session.headers['set-cookie']).split(';')[0];
    const headers = { cookie: guest, origin: 'http://localhost:80', 'x-csrf-token': session.json().csrfToken };
    const meal = mealWith(); meal.health = true; meal.diseases = ['测试疾病'];
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(meal) })).statusCode, 401);
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers, payload: { mode: 'local-test' } });
    headers.cookie = `${guest}; ${String(login.headers['set-cookie']).split(';')[0]}`;
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers: { ...headers, 'x-csrf-token': 'bad' }, payload: request(meal) })).statusCode, 403);
    const result = (await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(meal) })).json();
    assert.equal(calls, 1); assert.equal(result.status, 'unavailable'); assert.deepEqual(result.dishes, []);
    assert.equal(result.healthAssessment.state, 'evidence_required'); assert.deepEqual(result.healthAssessment.plan, plan);
    meal.version++; meal.restrictions = [{ id: 'r', kind: 'allergy', name: '未知', targets: [], status: 'unknown', scope: 'self', original: '未知' }];
    const blocked = (await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(meal) })).json();
    assert.equal(blocked.status, 'needs_confirmation'); assert.equal(calls, 1);
    meal.version++; meal.health = false; meal.restrictions = [];
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(meal) })).json().status, 'completed'); assert.equal(calls, 1);
  } finally { await app.close(); }
});

test('模型慢响应不能把旧健康计划发布到更新的本餐', async () => {
  let release!: () => void, notify!: () => void;
  const started = new Promise<void>(resolve => { notify = resolve; });
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const app = await createApp({ localTestFeatures: true, healthModel: { prepare: async () => {
    notify(); await waiting; return { state: 'evidence_required', message: '旧计划', plan };
  } } });
  try {
    const session = await app.inject('/api/v1/auth/session');
    const guest = String(session.headers['set-cookie']).split(';')[0];
    const headers = { cookie: guest, origin: 'http://localhost:80', 'x-csrf-token': session.json().csrfToken };
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers, payload: { mode: 'local-test' } });
    headers.cookie += `; ${String(login.headers['set-cookie']).split(';')[0]}`;
    const meal = mealWith(); meal.health = true; meal.diseases = ['测试疾病'];
    const old = app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(meal) });
    // inject is thenable; start it before waiting for the adapter notification.
    const oldResponse = Promise.resolve(old);
    await started;
    const current = await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request({ ...meal, version: 1, health: false }) });
    assert.equal(current.json().status, 'completed');
    release(); const stale = (await oldResponse).json();
    assert.equal(stale.status, 'cancelled'); assert.equal(stale.healthAssessment, undefined); assert.deepEqual(stale.dishes, []);
  } finally { release(); await app.close(); }
});
