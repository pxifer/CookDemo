import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractText } from '../shared/extraction';
import { recipes, foods, categories } from '../shared/catalog';
import { CONTENT_VERSION, type RecommendationRequest } from '../shared/types';
import { extractionSchema, recommendationSchema } from '../shared/schema';
import { assertMeal, DomainError, recommend } from './recommendation';

export async function createApp(options: { staticRoot?: string; origin?: string; localTestFeatures?: boolean } = {}) {
  const localTestFeatures = options.localTestFeatures === true;
  if (localTestFeatures && options.origin && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(options.origin).hostname)) throw new Error('Local test identity is restricted to loopback origins');
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024, ajv: { customOptions: { coerceTypes: false, removeAdditional: false } } });
  const secret = randomBytes(32);
  const sign = (s: string) => createHmac('sha256', secret).update(s).digest('base64url');
  const equal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const latest = new Map<string, { version: number; operation: string; touched: number }>();
  const rate = new Map<string, { at: number; count: number }>();
  const testSessions = new Map<string, { guest: string; expires: number }>();
  const prune = setInterval(() => {
    const cutoff = Date.now() - 30 * 60_000;
    for (const [k, v] of latest) if (v.touched < cutoff) latest.delete(k);
    for (const [k, v] of rate) if (v.at < cutoff) rate.delete(k);
    for (const [k, v] of testSessions) if (v.expires <= Date.now()) testSessions.delete(k);
  }, 60_000).unref();
  app.addHook('onClose', async () => { clearInterval(prune); });
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'no-referrer')
      .header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
      .header('Cache-Control', 'no-store');
  });
  const session = (cookie: string | undefined) => {
    const token = cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('shiwei_guest='))?.slice(13);
    if (!token) return null;
    const parts = token.split('.');
    return parts.length === 2 && /^[a-f0-9]{32}$/.test(parts[0]) && equal(parts[1], sign(parts[0])) ? parts[0] : null;
  };
  const testSession = (cookie: string | undefined) => {
    if (!localTestFeatures) return null;
    const token = cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('shiwei_test_session='))?.slice('shiwei_test_session='.length);
    if (!token) return null;
    const current = testSessions.get(token);
    return current && current.guest === session(cookie) && current.expires > Date.now() ? token : null;
  };
  const testCookie = (token: string, maxAge: number) => `shiwei_test_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${options.origin?.startsWith('https:') ? '; Secure' : ''}`;
  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    const subject = session(req.headers.cookie);
    if (!subject) throw new DomainError('SESSION_REQUIRED', 401, '请刷新页面建立本机会话');
    const origin = options.origin ?? `http://${req.headers.host}`;
    if (req.headers.origin !== origin || req.headers['x-csrf-token'] !== sign(`csrf:${subject}`) || req.headers['sec-fetch-site'] === 'cross-site') throw new DomainError('ORIGIN_REJECTED', 403, '请求来源或会话校验失败，请刷新后重试');
    const bucket = rate.get(subject) ?? { at: Date.now(), count: 0 };
    if (Date.now() - bucket.at > 60_000) { bucket.at = Date.now(); bucket.count = 0; }
    if (++bucket.count > 60) { reply.header('Retry-After', '60'); throw new DomainError('RATE_LIMIT', 429, '本机会话请求过于频繁，请稍后重试'); }
    rate.set(subject, bucket);
  });
  app.setErrorHandler((error, req, reply) => {
    const e = error as Error & { validation?: unknown; statusCode?: number; code?: string };
    const status = e.validation ? 400 : e.statusCode ?? 500;
    reply.code(status).send({ error: { code: e.validation ? 'INVALID_REQUEST' : e.code ?? 'INTERNAL_ERROR', message: e.validation ? '输入格式不合法，请检查人数、数量和已确认状态' : status < 500 ? e.message : '服务暂不可用，输入已保留', requestId: req.id, retryable: status >= 500 } });
  });
  await app.register(swagger, { openapi: { info: { title: '拾味本地开发 API', version: '0.1.0', description: '仅构造内容；真实账户、模型和健康支持尚未准入。' } } });
  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/readyz', async () => ({ status: 'local_only', contentVersion: CONTENT_VERSION, localTestFeatures, gates: { model: false, cloud: false, accounts: false, health: false } }));
  app.get('/api/v1/auth/session', async (req, reply) => {
    const id = session(req.headers.cookie) ?? randomBytes(16).toString('hex');
    reply.header('Set-Cookie', `shiwei_guest=${id}.${sign(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800${options.origin?.startsWith('https:') ? '; Secure' : ''}`);
    const loggedIn = Boolean(testSession(req.headers.cookie));
    return { identity: loggedIn ? 'local-test' : 'guest', ...(loggedIn ? { displayName: '本机测试账号' } : {}), csrfToken: sign(`csrf:${id}`), accountAvailable: localTestFeatures, localTestFeatures };
  });
  app.get('/api/v1/catalog/recipes', async () => ({ contentVersion: CONTENT_VERSION, contentState: 'constructed', recipes, foods, categories }));
  app.get('/api/v1/openapi.json', async () => app.swagger());
  app.post<{ Body: { text: string } }>('/api/v1/recognitions/text', { schema: { body: extractionSchema } }, async req => extractText(req.body.text));
  app.post('/api/v1/recognitions/image', async () => { throw new DomainError('MODEL_NOT_ADMITTED', 503, '图片识别尚未准入，请保留图片并使用文字或人工录入'); });
  app.post<{ Body: { mode: 'local-test' } }>('/api/v1/auth/login', async (req, reply) => {
    if (!localTestFeatures) throw new DomainError('AUTH_NOT_ADMITTED', 503, '账户服务暂不可用，本机收藏和常用偏好可继续使用');
    if (!req.body || req.body.mode !== 'local-test' || Object.keys(req.body).length !== 1) throw new DomainError('INVALID_LOGIN', 400, '请选择本机测试登录');
    if (testSessions.size >= 1000) throw new DomainError('TEST_SESSION_LIMIT', 503, '测试会话已满，请稍后重试');
    const old = testSession(req.headers.cookie); if (old) testSessions.delete(old);
    const token = randomBytes(32).toString('base64url');
    testSessions.set(token, { guest: session(req.headers.cookie)!, expires: Date.now() + 30 * 60_000 });
    reply.header('Set-Cookie', testCookie(token, 1800));
    return { identity: 'local-test', displayName: '本机测试账号' };
  });
  app.post('/api/v1/auth/logout', async (req, reply) => {
    const token = testSession(req.headers.cookie); if (token) testSessions.delete(token);
    reply.header('Set-Cookie', testCookie('', 0));
    return { identity: 'guest' };
  });
  app.post<{ Body: RecommendationRequest }>('/api/v1/recommendations', { schema: { body: recommendationSchema } }, async (req, reply) => {
    const subject = session(req.headers.cookie)!;
    const current = latest.get(subject);
    if (current && req.body.meal.version < current.version) throw new DomainError('STALE_MEAL', 409, '本餐已有新版本，请按当前条件重新生成');
    latest.set(subject, { version: req.body.meal.version, operation: req.body.operationId, touched: Date.now() });
    assertMeal(req.body.meal);
    const localHealthTest = req.body.meal.health && localTestFeatures;
    if (localHealthTest && !testSession(req.headers.cookie)) throw new DomainError('LOGIN_REQUIRED', 401, '请先登录，再开启健康模式测试');
    const controller = new AbortController();
    const onClose = () => { if (!reply.raw.writableEnded) controller.abort(); };
    reply.raw.on('close', onClose);
    const stream = req.headers.accept === 'application/x-ndjson';
    if (stream) {
      reply.hijack();
      reply.raw.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      reply.raw.write(JSON.stringify({ type: 'progress', stage: '输入格式已校验，正在核对目录与库存' }) + '\n');
    }
    try {
      let result = await recommend(recipes, req.body, { signal: controller.signal, localHealthTest });
      if (localHealthTest && !testSession(req.headers.cookie)) result = { ...result, dishes: [], checks: [], status: 'cancelled', reasons: ['登录已失效，请重新登录后再试'] };
      const newest = latest.get(subject);
      if (newest?.operation !== req.body.operationId || newest?.version !== req.body.meal.version) result = { ...result, dishes: [], checks: [], status: 'cancelled', reasons: ['旧操作已被新条件取代'] };
      if (stream) { if (!reply.raw.destroyed) reply.raw.end(JSON.stringify({ type: 'result', result }) + '\n'); return; }
      return result;
    } catch (e) {
      if (stream) { if (!reply.raw.destroyed) reply.raw.end(JSON.stringify({ type: 'error', code: 'RECOMMENDATION_FAILED', message: '本次计算中断，请主动重试；原输入已保留' }) + '\n'); return; }
      throw e;
    } finally { reply.raw.removeListener('close', onClose); }
  });
  const root = options.staticRoot ?? resolve('build/web');
  if (existsSync(root)) await app.register(fastifyStatic, { root, prefix: '/', index: 'index.html' });
  return app;
}
