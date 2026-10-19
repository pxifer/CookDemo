import type { Database } from './db';
import { randomUUID } from 'node:crypto';
import { DomainError } from './recommendation';
export interface ErasureDependencies {
  // A confirmed receipt must come from durable, independent storage, not process memory.
  recordRevocation(id: string, userId: string, scope: string): Promise<void>;
  deleteIdentity(userId: string): Promise<void>;
}
export class ErasureProcessor {
  constructor(private db: Database, private dependencies: ErasureDependencies) {}
  async request(userId: string, scope: 'profile' | 'credentials' | 'favorites' | 'account') {
    const id = randomUUID();
    const { rows } = await this.db.query(`WITH owner AS (
      UPDATE accounts SET disabled=CASE WHEN $3='account' THEN true ELSE disabled END,version=version+1 WHERE id=$1 RETURNING id
    ), revoked AS (
      UPDATE credentials SET revoked=true WHERE user_id=$1 AND $3 IN ('credentials','account') AND EXISTS(SELECT 1 FROM owner)
    ) INSERT INTO erasures(id,user_id,scope,state) SELECT $2,id,$3,'pending' FROM owner RETURNING id`, [userId, id, scope]);
    if (!rows.length) throw new DomainError('ACCOUNT_NOT_FOUND', 404, '账户不存在');
    return id;
  }
  async advance(id: string) {
    const { rows } = await this.db.query<{ user_id: string; scope: string; journal_confirmed: boolean; auth_deleted: boolean; data_deleted: boolean; state: string }>(`UPDATE erasures SET state=CASE WHEN state='completed' THEN state ELSE 'processing' END,attempts=attempts+1 WHERE id=$1 RETURNING *`, [id]);
    const task = rows[0];
    if (!task || task.state === 'completed') return;
    if (!task.journal_confirmed) {
      await this.dependencies.recordRevocation(id, task.user_id, task.scope);
      await this.db.query('UPDATE erasures SET journal_confirmed=true WHERE id=$1', [id]);
    }
    if (!task.auth_deleted) {
      if (task.scope === 'account') await this.dependencies.deleteIdentity(task.user_id);
      await this.db.query('UPDATE erasures SET auth_deleted=true WHERE id=$1', [id]);
    }
    if (!task.data_deleted) {
      // Statements are idempotent; a crash at any boundary resumes from persisted flags.
      if (['account', 'profile'].includes(task.scope)) await this.db.query('DELETE FROM profiles WHERE user_id=$1', [task.user_id]);
      if (['account', 'credentials'].includes(task.scope)) await this.db.query('DELETE FROM credentials WHERE user_id=$1', [task.user_id]);
      if (['account', 'favorites'].includes(task.scope)) await this.db.query('DELETE FROM favorites WHERE user_id=$1', [task.user_id]);
      await this.db.query('UPDATE erasures SET data_deleted=true WHERE id=$1', [id]);
    }
    await this.db.query("UPDATE erasures SET state='completed' WHERE id=$1 AND journal_confirmed AND auth_deleted AND data_deleted", [id]);
  }
}
export function restoreCanOpen(evidence: { independentJournalVerified: boolean; latestHeadVerified: boolean; appliedWatermark: number; requiredWatermark: number; identitiesVerified: boolean; keysVerified: boolean }) {
  return evidence.independentJournalVerified && evidence.latestHeadVerified && evidence.appliedWatermark >= evidence.requiredWatermark && evidence.identitiesVerified && evidence.keysVerified;
}
