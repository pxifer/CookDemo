import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { appendFile, copyFile, open, stat, unlink } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Versioned, authenticated envelope. Keys are stored separately from archives.
const magic = Buffer.from('SWBK0001');
const maxHeader = 4096;
export interface BackupMetadata {
  scope: 'local-empty-structure'|'business-snapshot'; format: 'pg_dump-custom'|'business-json-v1'; database: string;
  createdAt: string; migrationChecksums: string[];
  manifestHash?:string;
}
interface Header extends BackupMetadata { algorithm: 'aes-256-gcm'; keyId: string; nonce: string }
const keyId = (key: Buffer) => createHash('sha256').update(key).digest('hex').slice(0, 16);
function validateKey(key: Buffer) { if (key.length !== 32) throw new Error('BACKUP_KEY_INVALID'); }
function validateMetadata(value: BackupMetadata) {
  const structure=value.scope==='local-empty-structure'&&value.format==='pg_dump-custom'&&value.migrationChecksums?.length===3;
  const business=value.scope==='business-snapshot'&&value.format==='business-json-v1'&&/^[a-f0-9]{64}$/.test(value.manifestHash??'')&&value.migrationChecksums?.length>0&&value.migrationChecksums.length<=100;
  if ((!structure&&!business) ||
      !/^[a-z][a-z0-9_]{0,62}$/.test(value.database) ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.createdAt) ||
      !Number.isFinite(Date.parse(value.createdAt)) || !Array.isArray(value.migrationChecksums) ||
      value.migrationChecksums.some(v => !/^[a-f0-9]{64}$/.test(v))) {
    throw new Error('BACKUP_METADATA_INVALID');
  }
}
async function publish(temporary: string, destination: string) {
  // Only copy completed/authenticated bytes; exclusive copy preserves existing files.
  // Callers must await completion before opening the destination (copy is not atomic).
  await copyFile(temporary, destination, constants.COPYFILE_EXCL);
  await unlink(temporary);
}
export async function sha256File(path: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export async function encryptBackup(source: Readable, destination: string, key: Buffer, metadata: BackupMetadata) {
  validateKey(key); validateMetadata(metadata);
  const nonce = randomBytes(12);
  const header: Header = { ...metadata, algorithm: 'aes-256-gcm', keyId: keyId(key), nonce: nonce.toString('base64') };
  const json = Buffer.from(JSON.stringify(header));
  if (json.length > maxHeader) throw new Error('BACKUP_METADATA_INVALID');
  const prefix = Buffer.alloc(12); magic.copy(prefix); prefix.writeUInt32BE(json.length, 8);
  const authenticatedHeader = Buffer.concat([prefix, json]);
  const temporary = `${destination}.partial-${randomUUID()}`;
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(authenticatedHeader);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(authenticatedHeader);
    await pipeline(source, cipher, file.createWriteStream());
    await appendFile(temporary, cipher.getAuthTag());
    await publish(temporary, destination);
    return { ...metadata, keyId: header.keyId, sha256: await sha256File(destination), bytes: (await stat(destination)).size };
  } finally {
    await file.close().catch(() => {});
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
export async function decryptBackup(source: string, destination: string, key: Buffer): Promise<BackupMetadata> {
  validateKey(key);
  const input = await open(source, 'r');
  const temporary = `${destination}.partial-${randomUUID()}`;
  let output;
  try {
    const size = (await input.stat()).size;
    const prefix = Buffer.alloc(12);
    if ((await input.read(prefix, 0, 12, 0)).bytesRead !== 12 || !prefix.subarray(0, 8).equals(magic)) throw new Error();
    const length = prefix.readUInt32BE(8), offset = 12 + length;
    if (length < 2 || length > maxHeader || size <= offset + 16) throw new Error();
    const json = Buffer.alloc(length), tag = Buffer.alloc(16);
    if ((await input.read(json, 0, length, 12)).bytesRead !== length ||
        (await input.read(tag, 0, 16, size - 16)).bytesRead !== 16) throw new Error();
    const header = JSON.parse(json.toString('utf8')) as Header;
    validateMetadata(header);
    const nonce = Buffer.from(header.nonce, 'base64');
    if (header.algorithm !== 'aes-256-gcm' || header.keyId !== keyId(key) || nonce.length !== 12 || nonce.toString('base64') !== header.nonce) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(Buffer.concat([prefix, json])); decipher.setAuthTag(tag);
    output = await open(temporary, 'wx', 0o600);
    await pipeline(input.createReadStream({ start: offset, end: size - 17, autoClose: false }), decipher, output.createWriteStream());
    // Nothing at destination is visible to restore tools until GCM authentication succeeds.
    await publish(temporary, destination);
    return { scope: header.scope, format: header.format, database: header.database,
      createdAt: header.createdAt, migrationChecksums: header.migrationChecksums,...(header.scope==='business-snapshot'?{manifestHash:header.manifestHash}:{}) };
  } catch {
    throw new Error('BACKUP_RESTORE_REJECTED');
  } finally {
    await input.close(); await output?.close().catch(() => {});
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
