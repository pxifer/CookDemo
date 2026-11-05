import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../backend/src/app';
import { mealWith, request } from './fixtures';

test('V-01 / V-09: 运行时Schema、来源和CSRF拒绝、无秘密错误输出、OpenAPI', async () => {
  const app = await createApp();
  try {
    const session = await app.inject('/api/v1/auth/session');
    const cookie = session.headers['set-cookie']!.toString().split(';')[0], token = session.json().csrfToken;
    const headers = { cookie, origin: 'http://localhost:80', 'x-csrf-token': token };
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/recommendations', payload: request() })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/recommendations', payload: request(), headers: { ...headers, origin: 'https://evil.invalid' } })).statusCode, 403);
    for (const fields of [{ servings: 1.5 }, { servings: '2' }, { servings: 0 }, { mode: 'unknown' }, { allowBuy: 'true' }]) {
      const req = request(); Object.assign(req.meal, fields);
      const res = await app.inject({ method: 'POST', url: '/api/v1/recommendations', payload: req, headers });
      assert.equal(res.statusCode, 400, res.body); assert.equal(res.json().error.code, 'INVALID_REQUEST');
    }
    const extra = await app.inject({ method: 'POST', url: '/api/v1/recognitions/text', payload: { text: '鸡蛋', execute: 'ignore safety' }, headers });
    assert.equal(extra.statusCode, 400);
    const model = await app.inject({ method: 'POST', url: '/api/v1/recognitions/image', payload: {}, headers });
    assert.equal(model.statusCode, 400); assert.equal(model.json().error.code, 'INVALID_REQUEST');
    const auth = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: {}, headers }); assert.equal(auth.statusCode, 503);
    const schema = await app.inject('/api/v1/openapi.json'); assert.equal(schema.statusCode, 200); assert(schema.json().paths['/api/v1/recommendations']);
    assert.match(session.headers['set-cookie']!.toString(), /HttpOnly/); assert.match(session.headers['set-cookie']!.toString(), /SameSite=Strict/);
    assert.equal(session.headers['cache-control'], 'no-store'); assert.match(session.headers['content-security-policy']!.toString(), /script-src 'self'/);
  } finally { await app.close(); }
});
test('V-04 / V-07: NDJSON唯一终态、真实完整结果、旧版本拒绝', async () => {
  const app = await createApp();
  try {
    const session = await app.inject('/api/v1/auth/session');
    const headers = { cookie: session.headers['set-cookie']!.toString().split(';')[0], origin: 'http://localhost:80', 'x-csrf-token': session.json().csrfToken, accept: 'application/x-ndjson' };
    const m = mealWith(); m.version = 10;
    const res = await app.inject({ method: 'POST', url: '/api/v1/recommendations', payload: request(m), headers });
    assert.equal(res.statusCode, 200);
    const events = res.body.trim().split('\n').map(s => JSON.parse(s));
    assert.equal(events.filter(e => e.type === 'result').length, 1);
    assert.equal(events.at(-1).result.dishes.length, 3);
    assert(events.filter(e => e.type === 'progress').every(e => !e.dishes));
    const old = await app.inject({ method: 'POST', url: '/api/v1/recommendations', payload: request({ ...m, version: 9 }), headers });
    assert.equal(old.statusCode, 409); assert.equal(old.json().error.code, 'STALE_MEAL');
  } finally { await app.close(); }
});
test('服务端不信任客户端确认后的伪造限制范围和重复食材', async () => {
  const app = await createApp();
  try {
    const s = await app.inject('/api/v1/auth/session');
    const headers = { cookie: s.headers['set-cookie']!.toString().split(';')[0], origin: 'http://localhost:80', 'x-csrf-token': s.json().csrfToken };
    const m = mealWith();
    m.restrictions = [{ id: 'r', kind: 'allergy', name: '鸡蛋', targets: [], status: 'confirmed', scope: 'self', original: '鸡蛋' }];
    const res = await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(m) });
    assert.equal(res.statusCode, 400); assert.equal(res.json().error.code, 'INVALID_RESTRICTION');
    m.restrictions = []; m.ingredients.push({ ...m.ingredients[0], id: 'duplicate' });
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(m) })).statusCode, 400);
  } finally { await app.close(); }
});

test('本机测试身份：显式启用、不可伪造、绑定游客、退出撤销且不返回凭证', async () => {
  const app = await createApp({ localTestFeatures: true });
  try {
    const session = await app.inject('/api/v1/auth/session');
    const guest = session.headers['set-cookie']!.toString().split(';')[0];
    const headers = { cookie: guest, origin: 'http://localhost:80', 'x-csrf-token': session.json().csrfToken };
    assert.equal(session.json().identity, 'guest'); assert.equal(session.json().localTestFeatures, true);
    const spoof = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers, payload: { mode: 'local-test', identity: 'admin' } });
    assert.equal(spoof.statusCode, 400);
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers, payload: { mode: 'local-test' } });
    assert.equal(login.statusCode, 200); assert.equal(login.json().identity, 'local-test');
    assert(!('token' in login.json())); assert.match(login.headers['set-cookie']!.toString(), /HttpOnly; SameSite=Strict/);
    const cookie = `${guest}; ${login.headers['set-cookie']!.toString().split(';')[0]}`;
    assert.equal((await app.inject({ url: '/api/v1/auth/session', headers: { cookie } })).json().identity, 'local-test');
    const other = await app.inject('/api/v1/auth/session');
    const stolen = `${other.headers['set-cookie']!.toString().split(';')[0]}; ${login.headers['set-cookie']!.toString().split(';')[0]}`;
    assert.equal((await app.inject({ url: '/api/v1/auth/session', headers: { cookie: stolen } })).json().identity, 'guest');
    const logout = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { ...headers, cookie }, payload: {} });
    assert.equal(logout.statusCode, 200); assert.match(logout.headers['set-cookie']!.toString(), /Max-Age=0/);
    assert.equal((await app.inject({ url: '/api/v1/auth/session', headers: { cookie } })).json().identity, 'guest');
  } finally { await app.close(); }
  await assert.rejects(createApp({ localTestFeatures: true, origin: 'https://example.com' }), /loopback/);
});

test('健康测试只接受服务端登录，保留硬限制并明确没有执行疾病规则', async () => {
  const app = await createApp({ localTestFeatures: true });
  try {
    const session = await app.inject('/api/v1/auth/session');
    const guest = session.headers['set-cookie']!.toString().split(';')[0];
    const headers = { cookie: guest, origin: 'http://localhost:80', 'x-csrf-token': session.json().csrfToken };
    const m = mealWith(); m.health = true; m.diseases = ['高血压'];
    const before = await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(m) });
    assert.equal(before.statusCode, 401); assert.equal(before.json().error.code, 'LOGIN_REQUIRED');
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers, payload: { mode: 'local-test' } });
    headers.cookie = `${guest}; ${login.headers['set-cookie']!.toString().split(';')[0]}`;
    const result = await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(m) });
    assert.equal(result.statusCode, 200); assert.equal(result.json().status, 'completed');
    assert.equal(result.json().healthAssessment.state, 'test_only'); assert.match(result.json().healthAssessment.message, /不代表真实 AI 选菜/);
    m.version++; m.restrictions = [{ id: 'r', kind: 'allergy', name: '未知', targets: [], status: 'unknown', scope: 'self', original: '未知' }];
    const blocked = await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(m) });
    assert.equal(blocked.json().status, 'needs_confirmation'); assert.equal(blocked.json().dishes.length, 0);
    await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers, payload: {} });
    m.version++; assert.equal((await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers, payload: request(m) })).statusCode, 401);
  } finally { await app.close(); }
});
