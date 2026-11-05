import { createHash } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { RagInvocation } from './types';

export interface RagPricing { model: 'deepseek-flash'; currency: 'CNY'; inputPerMillion: number; outputPerMillion: number; verifiedDate: string; source: string }
export interface RagAuthorization { id: string; maximumCny: number; maximumCalls: number; purpose: 'public-evidence-rag-smoke'; status: 'active' | 'completed'; approvedDate: string }
export interface RagBudget {
  reserve(body: string, maximumOutputTokens: number): Promise<string>;
  record(attempt: string, invocation?: RagInvocation): Promise<void>;
  summary(): { maximumCny: number; maximumCalls: number; attempts: number; reservedCny: number; estimatedKnownCostCny: number; unknownUsageAttempts: number };
  close(): Promise<void>;
}
type RecordRow = { kind: 'reserved'; attempt: string; microCny: number; inputHash: string; at: string }
  | { kind: 'receipt'; attempt: string; invocation: RagInvocation | null; estimatedMicroCny: number; at: string };
export async function openRagBudget(authorization: RagAuthorization, pricing: RagPricing, ledgerPath: string,
  today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())): Promise<RagBudget> {
  if (authorization.status !== 'active' || authorization.purpose !== 'public-evidence-rag-smoke'
    || !/^[a-z0-9-]{8,80}$/.test(authorization.id) || !Number.isFinite(authorization.maximumCny) || authorization.maximumCny <= 0 || authorization.maximumCny > 5
    || !Number.isSafeInteger(authorization.maximumCalls) || authorization.maximumCalls < 1 || authorization.maximumCalls > 50) throw Error('RAG_LIVE_AUTHORIZATION_REQUIRED');
  if (pricing.model !== 'deepseek-flash' || pricing.currency !== 'CNY' || pricing.verifiedDate !== today || !/^https:\/\/api-docs\.deepseek\.com\//.test(pricing.source)
    || ![pricing.inputPerMillion, pricing.outputPerMillion].every(value => Number.isFinite(value) && value > 0)) throw Error('RAG_PRICING_VERIFICATION_REQUIRED');
  await mkdir(dirname(ledgerPath), { recursive: true });
  const lock = await open(ledgerPath + '.lock', 'wx', 0o600);
  try {
    let text = '';
    try { text = await readFile(ledgerPath, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (text && !text.endsWith('\n')) throw Error('RAG_BUDGET_LEDGER_TRUNCATED');
    const rows: RecordRow[] = text.trim() ? text.trim().split('\n').map(line => JSON.parse(line)) : [];
    const attempts = new Map<string, Extract<RecordRow, { kind: 'reserved' }>>();
    const receipts = new Map<string, Extract<RecordRow, { kind: 'receipt' }>>();
    for (const row of rows) {
      if (row.kind === 'reserved') {
        if (!row.attempt.startsWith(authorization.id + ':') || attempts.has(row.attempt) || !Number.isSafeInteger(row.microCny) || row.microCny < 1) throw Error('RAG_BUDGET_LEDGER_INVALID');
        attempts.set(row.attempt, row);
      } else if (row.kind === 'receipt') {
        if (!attempts.has(row.attempt) || receipts.has(row.attempt) || !Number.isSafeInteger(row.estimatedMicroCny) || row.estimatedMicroCny < 0) throw Error('RAG_BUDGET_LEDGER_INVALID');
        receipts.set(row.attempt, row);
      } else throw Error('RAG_BUDGET_LEDGER_INVALID');
    }
    const file = await open(ledgerPath, 'a', 0o600);
    const append = async (row: RecordRow) => { await file.writeFile(JSON.stringify(row) + '\n'); await file.sync(); };
    let tail: Promise<unknown> = Promise.resolve();
    const serialize = <T>(work: () => Promise<T>): Promise<T> => {
      const result = tail.then(work, work); tail = result.catch(() => {}); return result;
    };
    let reserved = [...attempts.values()].reduce((sum, row) => sum + row.microCny, 0);
    if (!Number.isSafeInteger(reserved) || reserved > Math.floor(authorization.maximumCny * 1_000_000) || attempts.size > authorization.maximumCalls) {
      await file.close(); throw Error('RAG_BUDGET_ALREADY_EXCEEDS_AUTHORIZATION');
    }
    return {
      reserve: (body, maximumOutputTokens) => serialize(async () => {
        if (!Number.isSafeInteger(maximumOutputTokens) || maximumOutputTokens < 1 || maximumOutputTokens > 4000) throw Error('RAG_OUTPUT_BUDGET_INVALID');
        if (attempts.size >= authorization.maximumCalls) throw Error('RAG_CALL_LIMIT_EXHAUSTED');
        // Conservative byte-based input bound plus protocol allowance; reserve at verified peak prices.
        const microCny = Math.ceil((Buffer.byteLength(body) + 4096) * pricing.inputPerMillion + maximumOutputTokens * pricing.outputPerMillion);
        if (reserved + microCny > Math.floor(authorization.maximumCny * 1_000_000)) throw Error('RAG_BUDGET_EXHAUSTED');
        const attempt = `${authorization.id}:${attempts.size + 1}`;
        const row: Extract<RecordRow, { kind: 'reserved' }> = { kind: 'reserved', attempt, microCny, inputHash: createHash('sha256').update(body).digest('hex'), at: new Date().toISOString() };
        await append(row); attempts.set(attempt, row); reserved += microCny;
        return attempt;
      }),
      record: (attempt, invocation) => serialize(async () => {
        if (!attempts.has(attempt) || receipts.has(attempt)) throw Error('RAG_BUDGET_RECEIPT_INVALID');
        if (invocation && (![invocation.promptTokens, invocation.completionTokens, invocation.totalTokens].every(value => Number.isSafeInteger(value) && value >= 0)
          || invocation.totalTokens !== invocation.promptTokens + invocation.completionTokens)) throw Error('RAG_BUDGET_RECEIPT_INVALID');
        const estimatedMicroCny = invocation ? Math.ceil(invocation.promptTokens * pricing.inputPerMillion + invocation.completionTokens * pricing.outputPerMillion) : 0;
        const row: Extract<RecordRow, { kind: 'receipt' }> = { kind: 'receipt', attempt, invocation: invocation ?? null, estimatedMicroCny, at: new Date().toISOString() };
        await append(row); receipts.set(attempt, row);
      }),
      summary: () => ({ maximumCny: authorization.maximumCny, maximumCalls: authorization.maximumCalls, attempts: attempts.size, reservedCny: reserved / 1_000_000,
        estimatedKnownCostCny: [...receipts.values()].reduce((sum, row) => sum + row.estimatedMicroCny, 0) / 1_000_000,
        unknownUsageAttempts: [...attempts.keys()].filter(id => !receipts.get(id)?.invocation).length }),
      close: async () => { await tail; await file.close(); await lock.close(); await unlink(ledgerPath + '.lock'); },
    };
  } catch (error) { await lock.close(); await unlink(ledgerPath + '.lock'); throw error; }
}
