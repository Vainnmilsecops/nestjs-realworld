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

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const [algorithm, salt, encodedKey] = hash.split('$');
  if (
    algorithm !== 'scrypt' ||
    !salt ||
    !encodedKey ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{128}$/.test(encodedKey)
  )
    return false;
  const expected = Buffer.from(encodedKey, 'hex');
  const actual = await deriveKey(password, salt);
  return timingSafeEqual(expected, actual);
}

// Perform the same password derivation for unknown accounts to avoid a fast failure path.
export const DUMMY_PASSWORD_HASH = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
