// src/lib/crypto.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCODING = 'hex';
const IV_LENGTH = 16;
const KEY = process.env.ENCRYPTION_KEY;

if (!KEY || KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY en .env debe tener exactamente 32 caracteres.');
}

export function encrypt(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY), iv);
  
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  return `${iv.toString(ENCODING)}:${encrypted.toString(ENCODING)}`;
}

export function decrypt(text: string): string {
  if (!text || !text.includes(':')) return text;

  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, ENCODING);
  const encryptedText = Buffer.from(encryptedHex, ENCODING);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY), iv);
  
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString();
}