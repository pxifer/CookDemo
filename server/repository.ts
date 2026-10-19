import type { Database } from './db';
import { seal, open, type Envelope } from './crypto';
import { DomainError } from './recommendation';
export class ProfileRepository {
  constructor(private db: Database, private key: Buffer, private keyVersion = 'profile-v1') {}
  async load(userId: string) {
    const { rows } = await this.db.query<{ version: number; envelope: Envelope }>('SELECT p.version, p.envelope FROM profiles p JOIN accounts a ON a.id=p.user_id WHERE p.user_id=$1 AND NOT a.disabled', [userId]);
    return rows[0] ? { version: rows[0].version, value: open(rows[0].envelope, this.key, userId, 'profile') } : null;
  }
  async save(userId: string, expected: number, value: unknown) {
    const envelope = seal(value, this.key, userId, 'profile', this.keyVersion);
    const result = expected === 0
      ? await this.db.query('INSERT INTO profiles(user_id,version,envelope) SELECT id,1,$2::jsonb FROM accounts WHERE id=$1 AND NOT disabled ON CONFLICT DO NOTHING RETURNING version', [userId, JSON.stringify(envelope)])
      : await this.db.query('UPDATE profiles SET version=version+1,envelope=$3::jsonb WHERE user_id=$1 AND version=$2 AND EXISTS(SELECT 1 FROM accounts WHERE id=$1 AND NOT disabled) RETURNING version', [userId, expected, JSON.stringify(envelope)]);
    if (!result.rows.length) throw new DomainError('VERSION_CONFLICT', 409, '资料已变化或账户已禁用，请重新核对差异');
    return result.rows[0];
  }
}
