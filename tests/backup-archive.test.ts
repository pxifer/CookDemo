import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { encryptBackup, decryptBackup, type BackupMetadata } from '../scripts/lib/backup-archive';

const metadata: BackupMetadata = { scope: 'local-empty-structure', format: 'pg_dump-custom', database: 'shiwei_dev',
  createdAt: '2026-10-21T00:00:00.000Z', migrationChecksums: ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)] };
test('加密备份可恢复二进制，独立随机nonce；拒绝覆盖已有归档和恢复目标', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shiwei-backup-test-'));
  try {
    const key = randomBytes(32), bytes = randomBytes(1024 * 256);
    const a = join(dir, 'a.swbk'), b = join(dir, 'b.swbk'), out = join(dir, 'restored.dump');
    await encryptBackup(Readable.from([bytes]), a, key, metadata);
    await encryptBackup(Readable.from([bytes]), b, key, metadata);
    assert.notDeepEqual(await readFile(a), await readFile(b));
    assert.deepEqual(await decryptBackup(a, out, key), metadata);
    assert.deepEqual(await readFile(out), bytes);
    await assert.rejects(encryptBackup(Readable.from([Buffer.from('replacement')]), a, key, metadata));
    await assert.rejects(decryptBackup(b, out, key), /BACKUP_RESTORE_REJECTED/);
    assert.deepEqual(await readFile(out), bytes);
    assert.equal((await readdir(dir)).filter(n => n.includes('.partial-')).length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('错误密钥、头部/密文/认证标签篡改及截断均在恢复前拒绝，清理不完整明文', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shiwei-backup-test-'));
  try {
    const key = randomBytes(32), archive = join(dir, 'valid.swbk');
    await encryptBackup(Readable.from([randomBytes(4096)]), archive, key, metadata);
    const original = await readFile(archive), offset = 12 + original.readUInt32BE(8);
    const mutations = [Buffer.alloc(0), original.subarray(0, 10), original.subarray(0, original.length - 16)];
    for (const at of [0, 8, 20, offset + 10, original.length - 1]) {
      const changed = Buffer.from(original); changed[at] ^= 1; mutations.push(changed);
    }
    await assert.rejects(decryptBackup(archive, join(dir, 'wrong-key.dump'), randomBytes(32)), /BACKUP_RESTORE_REJECTED/);
    for (const [index, bytes] of mutations.entries()) {
      const input = join(dir, `bad-${index}.swbk`), target = join(dir, `out-${index}.dump`);
      await writeFile(input, bytes);
      await assert.rejects(decryptBackup(input, target, key), /BACKUP_RESTORE_REJECTED/);
      await assert.rejects(readFile(target), { code: 'ENOENT' });
    }
    assert.equal((await readdir(dir)).filter(n => n.includes('.partial-')).length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('导出途中失败不发布归档，已有文件与部分输出清理边界保持正确', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shiwei-backup-test-'));
  try {
    const destination = join(dir, 'failed.swbk');
    const source = Readable.from((async function* () { yield Buffer.from('partial dump'); throw new Error('simulated export failure'); })());
    await assert.rejects(encryptBackup(source, destination, randomBytes(32), metadata), /simulated export failure/);
    assert.deepEqual(await readdir(dir), []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
