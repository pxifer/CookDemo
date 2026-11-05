import type { EmbeddingBatch, EmbeddingIdentity, EmbeddingProvider } from './types';

const identityFields: (keyof EmbeddingIdentity)[] = ['modelId', 'revision', 'dimensions', 'normalization', 'pooling', 'queryInstruction', 'documentInstruction', 'representationVersion', 'runtimeVersion'];
export function validateEmbeddingIdentity(value: unknown): EmbeddingIdentity {
  if (!value || typeof value !== 'object') throw Error('EMBEDDING_IDENTITY_INVALID');
  const item = value as Record<string, unknown>;
  for (const key of identityFields) {
    if (key === 'dimensions') {
      if (!Number.isSafeInteger(item[key]) || Number(item[key]) < 1 || Number(item[key]) > 16000) throw Error('EMBEDDING_IDENTITY_INVALID');
    } else if (typeof item[key] !== 'string' || String(item[key]).length > 2000 || !['queryInstruction', 'documentInstruction'].includes(key) && !item[key]) {
      throw Error('EMBEDDING_IDENTITY_INVALID');
    }
  }
  if (item.normalization !== 'l2' || !/^[a-f0-9]{40}$/.test(String(item.revision))) throw Error('EMBEDDING_IDENTITY_INVALID');
  return Object.fromEntries(identityFields.map(key => [key, item[key]])) as unknown as EmbeddingIdentity;
}
export function sameEmbeddingIdentity(a: EmbeddingIdentity, b: EmbeddingIdentity): boolean {
  return identityFields.every(key => a[key] === b[key]);
}
export function validateEmbeddingVector(vector: unknown, dimensions: number): number[] {
  if (!Array.isArray(vector) || vector.length !== dimensions || vector.some(value => typeof value !== 'number' || !Number.isFinite(value))) throw Error('EMBEDDING_VECTOR_INVALID');
  const norm = vector.reduce((sum, value) => sum + value * value, 0);
  if (Math.abs(norm - 1) > 0.002) throw Error('EMBEDDING_VECTOR_NOT_NORMALIZED');
  return vector;
}
export class LocalEmbeddingProvider implements EmbeddingProvider {
  private url: URL;
  private identity?: EmbeddingIdentity;
  constructor(baseURL = 'http://127.0.0.1:15199', private fetcher: typeof fetch = fetch, private timeoutMs = 180000) {
    const url = new URL(baseURL);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || !['', '/'].includes(url.pathname) || url.search || url.hash) throw Error('EMBEDDING_LOOPBACK_URL_REQUIRED');
    this.url = url;
  }
  private async request(path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
    const response = await this.fetcher(new URL(path, this.url), {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)]) : AbortSignal.timeout(this.timeoutMs),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) { await response.body?.cancel(); throw Error(`EMBEDDING_HTTP_${response.status}`); }
    if (!response.body) throw Error('EMBEDDING_EMPTY_RESPONSE');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > 8 * 1024 * 1024) throw Error('EMBEDDING_RESPONSE_TOO_LARGE');
        chunks.push(next.value);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  async describe(signal?: AbortSignal): Promise<EmbeddingIdentity> {
    const value = await this.request('/health', undefined, signal) as { status?: unknown; identity?: unknown };
    if (value?.status !== 'ready') throw Error('EMBEDDING_NOT_READY');
    const identity = validateEmbeddingIdentity(value.identity);
    if (this.identity && !sameEmbeddingIdentity(this.identity, identity)) throw Error('EMBEDDING_IDENTITY_CHANGED');
    this.identity = identity;
    return { ...identity };
  }
  async embed(texts: string[], role: 'query' | 'document', signal?: AbortSignal): Promise<EmbeddingBatch> {
    if (!['query', 'document'].includes(role) || !Array.isArray(texts) || texts.length < 1 || texts.length > 16 || texts.some(text => typeof text !== 'string' || !text.trim() || text.length > 16000)) throw Error('EMBEDDING_INPUT_INVALID');
    const identity = this.identity ?? await this.describe(signal);
    const result = await this.request('/embed', { texts, role }, signal) as Record<string, unknown>;
    const received = validateEmbeddingIdentity(result?.identity);
    if (!sameEmbeddingIdentity(identity, received)) throw Error('EMBEDDING_IDENTITY_CHANGED');
    if (!Array.isArray(result.vectors) || result.vectors.length !== texts.length || !Array.isArray(result.tokenCounts) || result.tokenCounts.length !== texts.length || result.tokenCounts.some(count => !Number.isSafeInteger(count) || count < 1)) throw Error('EMBEDDING_BATCH_INVALID');
    return { identity: received, vectors: result.vectors.map(vector => validateEmbeddingVector(vector, received.dimensions)), tokenCounts: result.tokenCounts };
  }
}
