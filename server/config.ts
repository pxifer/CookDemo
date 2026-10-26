import { readFileSync } from 'node:fs';

export class ConfigurationError extends Error {
  constructor(public field: string) { super(`配置 ${field} 无效或缺失，请按部署说明配置`); }
}
export interface RuntimeConfig {
  environment: 'local' | 'staging' | 'production'; host: string; port: number;
  origin?: string; localTestFeatures: boolean; databaseUrl?: string;
  database: { max: number; connectTimeoutMs: number; queryTimeoutMs: number; ca?: string };
  sessionSecret?: Buffer; csrfSecret?: Buffer; contentSource: 'constructed' | 'pending' | 'database'; contentRelease?: string;
  requireVector: boolean;
}
function secret(env: NodeJS.ProcessEnv, name: string): string | undefined {
  if (env[name] && env[`${name}_FILE`]) throw new ConfigurationError(name);
  if (env[`${name}_FILE`]) {
    try { return readFileSync(env[`${name}_FILE`]!, 'utf8').trim(); } catch { throw new ConfigurationError(`${name}_FILE`); }
  }
  return env[name] || undefined;
}
function integer(env: NodeJS.ProcessEnv, name: string, value: number, min: number, max: number) {
  const raw = env[name];
  if (raw !== undefined && !/^\d+$/.test(raw)) throw new ConfigurationError(name);
  const n = raw === undefined ? value : Number(raw);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new ConfigurationError(name);
  return n;
}
function key(env: NodeJS.ProcessEnv, name: string) {
  const value = secret(env, name);
  if (!value) return undefined;
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== 32 || bytes.toString('base64') !== value) throw new ConfigurationError(name);
  return bytes;
}
export const isLoopback = (host: string) => ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host);

export function readConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const environment = env.APP_ENV ?? 'local';
  if (!['local', 'staging', 'production'].includes(environment)) throw new ConfigurationError('APP_ENV');
  const deployed = environment !== 'local', host = env.HOST ?? (deployed ? '0.0.0.0' : '127.0.0.1');
  if (!['127.0.0.1', 'localhost', '::1', '0.0.0.0', '::'].includes(host)) throw new ConfigurationError('HOST');
  if (env.LOCAL_TEST_FEATURES !== undefined && !['0', '1'].includes(env.LOCAL_TEST_FEATURES)) throw new ConfigurationError('LOCAL_TEST_FEATURES');
  const localTestFeatures = env.LOCAL_TEST_FEATURES === '1';
  let origin = env.APP_ORIGIN;
  if (origin) {
    try {
      const url = new URL(origin);
      if (url.origin !== origin || url.username || url.password || !['http:', 'https:'].includes(url.protocol)) throw new Error();
      if (deployed && (url.protocol !== 'https:' || isLoopback(url.hostname))) throw new Error();
    } catch { throw new ConfigurationError('APP_ORIGIN'); }
  } else if (deployed) throw new ConfigurationError('APP_ORIGIN');
  if (localTestFeatures && (deployed || !isLoopback(host) || (origin && !isLoopback(new URL(origin).hostname)))) throw new ConfigurationError('LOCAL_TEST_FEATURES');
  // Shared metadata and account lifecycle are not ready for public exposure yet.
  if (!deployed && !isLoopback(host)) throw new ConfigurationError('HOST');
  const databaseUrl = secret(env, 'DATABASE_URL');
  let ca: string | undefined;
  if (env.DATABASE_CA_FILE) {
    try { ca = readFileSync(env.DATABASE_CA_FILE, 'utf8'); } catch { throw new ConfigurationError('DATABASE_CA_FILE'); }
  }
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.pathname || url.pathname === '/') throw new Error();
      const mode = url.searchParams.get('sslmode');
      if (['no-verify', 'prefer', 'allow'].includes(mode ?? '') || url.searchParams.has('ssl')) throw new Error();
      if (!isLoopback(url.hostname) && (mode !== 'verify-full' || !ca)) throw new Error();
    } catch { throw new ConfigurationError('DATABASE_URL'); }
  } else if (deployed) throw new ConfigurationError('DATABASE_URL');
  const sessionSecret = key(env, 'SESSION_SECRET_B64'), csrfSecret = key(env, 'CSRF_SECRET_B64');
  if (deployed && !sessionSecret) throw new ConfigurationError('SESSION_SECRET_B64');
  if (deployed && !csrfSecret) throw new ConfigurationError('CSRF_SECRET_B64');
  if (sessionSecret && csrfSecret && sessionSecret.equals(csrfSecret)) throw new ConfigurationError('CSRF_SECRET_B64');
  const contentSource = env.CONTENT_SOURCE ?? (deployed ? 'pending' : 'constructed');
  if (!['constructed', 'pending', 'database'].includes(contentSource) || (deployed && contentSource !== 'pending')) throw new ConfigurationError('CONTENT_SOURCE');
  const contentRelease = env.CONTENT_RELEASE_ID;
  if (contentSource === 'database' && (!databaseUrl || !contentRelease || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(contentRelease))) throw new ConfigurationError('CONTENT_RELEASE_ID');
  if (contentSource === 'database' && !isLoopback(new URL(databaseUrl!).hostname)) throw new ConfigurationError('DATABASE_LOCAL_CONTENT_ONLY');
  // These services are deliberately not admitted in this structural phase.
  for (const flag of ['MODEL_ENABLED', 'SEMANTIC_SEARCH_ENABLED', 'HEALTH_ENABLED', 'ACCOUNTS_ENABLED']) {
    if (env[flag] !== undefined && !['0', 'false'].includes(env[flag]!)) throw new ConfigurationError(flag);
  }
  if (env.DB_REQUIRE_VECTOR !== undefined && !['0', '1'].includes(env.DB_REQUIRE_VECTOR)) throw new ConfigurationError('DB_REQUIRE_VECTOR');
  return {
    environment: environment as RuntimeConfig['environment'], host, origin, localTestFeatures,
    port: integer(env, 'PORT', deployed ? 8080 : 4175, 1, 65535), databaseUrl,
    database: { max: integer(env, 'DB_POOL_MAX', 4, 1, 20), connectTimeoutMs: integer(env, 'DB_CONNECT_TIMEOUT_MS', 5000, 100, 30000), queryTimeoutMs: integer(env, 'DB_QUERY_TIMEOUT_MS', 5000, 100, 30000), ca },
    sessionSecret, csrfSecret, contentSource: contentSource as RuntimeConfig['contentSource'], contentRelease, requireVector: env.DB_REQUIRE_VECTOR === '1',
  };
}
