import { fingerprint, DomainError } from './recommendation';
import type { Database } from './db';
export interface Invocation { subject: string; operationId: string; input: unknown; feeMode: 'platform_free' | 'byok'; providerModel: string; credentialVersion: string | null; }
export class InvocationLedger {
  constructor(private db: Database, private fingerprintKey: Buffer) {}
  async admit(call: Invocation) {
    const hash = fingerprint(call, this.fingerprintKey);
    const inserted = await this.db.query(`INSERT INTO operations(subject,operation_id,fingerprint,fee_mode,state,credential_version,provider_model,max_attempts,expires_at)
      VALUES($1,$2,$3,$4,'admitted',$5,$6,$7,now()+interval '24 hours') ON CONFLICT DO NOTHING RETURNING state`,
      [call.subject, call.operationId, hash, call.feeMode, call.credentialVersion, call.providerModel, call.feeMode === 'byok' ? 1 : 2]);
    if (inserted.rows.length) return 'admitted';
    const { rows } = await this.db.query<{ fingerprint: string; state: string }>('SELECT fingerprint,state FROM operations WHERE subject=$1 AND operation_id=$2', [call.subject, call.operationId]);
    if (rows[0]?.fingerprint !== hash) throw new DomainError('OPERATION_MISMATCH', 409, '同一操作标识不能变更输入、凭证或费用选择');
    return rows[0].state;
  }
  async claim(call: Invocation, bucket: string) {
    // Single SQL statement: attempt and budget reservation share an atomic boundary.
    const { rows } = await this.db.query(`WITH candidate AS (
        SELECT subject,operation_id FROM operations WHERE subject=$1 AND operation_id=$2 AND fingerprint=$4
        AND state='admitted' AND attempts<max_attempts AND expires_at>now() FOR UPDATE
      ), reserved AS (
        UPDATE quota SET used=used+1 WHERE bucket=$3 AND used<maximum AND EXISTS(SELECT 1 FROM candidate) RETURNING bucket
      ) UPDATE operations SET attempts=attempts+1,state='attempting'
      WHERE subject=$1 AND operation_id=$2 AND EXISTS(SELECT 1 FROM candidate) AND EXISTS(SELECT 1 FROM reserved) RETURNING attempts`,
      [call.subject, call.operationId, bucket, fingerprint(call, this.fingerprintKey)]);
    return rows.length > 0;
  }
  async settle(call: Invocation, state: 'completed' | 'failed' | 'unknown', recoverable = false) {
    // Unknown upstream outcome stays reserved. BYOK never becomes eligible for automatic retry.
    await this.db.query(`UPDATE operations SET state=CASE WHEN $4='failed' AND $5 AND fee_mode='platform_free' AND attempts<max_attempts THEN 'admitted' ELSE $4 END
      WHERE subject=$1 AND operation_id=$2 AND fingerprint=$3 AND state='attempting'`, [call.subject, call.operationId, fingerprint(call, this.fingerprintKey), state, recoverable]);
  }
}
