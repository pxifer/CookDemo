import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';

const loopback = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
export function localHttpUrl(value) {
  try {
    const url = new URL(typeof value === 'object' && value !== null && 'url' in value ? value.url : value);
    return ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && loopback.has(url.hostname);
  } catch { return false; }
}
export function localTestEnvironment(source, guardUrl) {
  const env = {};
  for (const [key, value] of Object.entries(source)) {
    if (/^(?:CLOUDBASE_|TCB_|SHIWEI_EVALUATION_|DEEPSEEK_|HEALTH_MODEL_|IMAGE_MODEL_|IMAGE_ZHIPU_|RAG_(?:ALLOW_LIVE|DEEPSEEK_|LIVE_|PRICING_)|DATABASE_URL|TEST_DATABASE_URL|PG(?:HOST|PORT|USER|PASSWORD|DATABASE|SERVICE|SSLMODE)|SESSION_SECRET|CSRF_SECRET|PROFILE_ENCRYPTION_KEY|RUN_.*TESTS$|RUN_HEALTH_CHAT_POSTGRES$|CANDIDATE_PG_INTEGRATION$|NODE_OPTIONS$|APP_ENV$|APP_STAGE$|APP_ORIGIN$|HOST$|PORT$|CONTENT_SOURCE$|CONTENT_RELEASE_ID$|PLAYWRIGHT_PORT$|BUSINESS_BROWSER_PORT$|HEALTH_CHAT_E2E$|REGISTRATION_E2E_TEST$|BUSINESS_BROWSER$|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$|NO_PROXY$)/i.test(key)) continue;
    env[key] = value;
  }
  return { ...env, SHIWEI_LOCAL_TEST_ONLY: '1', EVALUATION_ALLOW_PAID: '0', RAG_ALLOW_LIVE: '0', RAG_BUSINESS_RESEARCH:'0', MODEL_ENABLED: '0',
    APP_ENV: 'local', APP_STAGE: 'local', CI: '1',
    NODE_OPTIONS: `--import=${guardUrl}`, NO_PROXY: '127.0.0.1,localhost,::1' };
}
function blocked() {
  const error = new Error('LOCAL_TEST_NETWORK_BLOCKED: only loopback HTTP is allowed');
  error.code = 'LOCAL_TEST_NETWORK_BLOCKED';
  return error;
}
function requestAllowed(args, protocol) {
  const first = args[0];
  const url = typeof first === 'string' || first instanceof URL ? new URL(first) : undefined;
  const options = url ? (typeof args[1] === 'object' ? args[1] : {}) : first;
  const host = options?.hostname ?? options?.host ?? url?.hostname ?? 'localhost';
  // http.request supports local Unix sockets too; they are not used by these tests.
  if (options?.socketPath || !loopback.has(host)) return false;
  return localHttpUrl(`${options?.protocol ?? url?.protocol ?? protocol}//${host === '::1' ? '[::1]' : host}`);
}
export function installLocalHttpGuard() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (!localHttpUrl(input)) throw blocked();
    // Do not follow a local endpoint's redirect into a public service.
    return originalFetch(input, { ...init, redirect: 'error' });
  };
  for (const [client, protocol] of [[http, 'http:'], [https, 'https:']]) {
    const request = client.request;
    client.request = function (...args) {
      if (!requestAllowed(args, protocol)) throw blocked();
      return request.apply(this, args);
    };
    client.get = function (...args) { const req = client.request(...args); req.end(); return req; };
  }
  syncBuiltinESMExports();
}
if (process.env.SHIWEI_LOCAL_TEST_ONLY === '1') installLocalHttpGuard();
