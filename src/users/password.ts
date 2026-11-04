import {randomBytes, scrypt, timingSafeEqual} from 'node:crypto';
const KEY_LENGTH = 64;

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [algorithm, salt, encodedKey] = hash.split('$');
  if (algorithm !== 'scrypt' || !salt || !encodedKey) return false;
  const expected = Buffer.from(encodedKey, 'hex');
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await deriveKey(password, salt);
  return timingSafeEqual(expected, actual);
}
