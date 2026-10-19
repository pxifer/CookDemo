import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
export interface Envelope { ciphertext: string; nonce: string; tag: string; keyVersion: string }
export function seal(value: unknown, key: Buffer, userId: string, purpose: string, version: string): Envelope {
  if (key.length !== 32) throw new Error('AES-256 key required');
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(JSON.stringify([userId, purpose, version])));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), keyVersion: version };
}
export function open(envelope: Envelope, key: Buffer, userId: string, purpose: string): unknown {
  const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.nonce, 'base64'));
  cipher.setAAD(Buffer.from(JSON.stringify([userId, purpose, envelope.keyVersion])));
  cipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(envelope.ciphertext, 'base64')), cipher.final()]).toString('utf8'));
}
