import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app';
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
    assert.equal(model.statusCode, 503); assert.equal(model.json().error.code, 'MODEL_NOT_ADMITTED');
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
