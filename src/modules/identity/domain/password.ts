import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { IdentityError } from './errors.js';

const parameters = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
// Bound expensive work per process, including callers outside HTTP.
let active = 0;
async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (active >= 2) throw new IdentityError(503);
  active++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, parameters, (error, key) =>
        error ? reject(error) : resolve(key),
      );
    });
  } finally {
    active--;
  }
}
export function validatePassword(password: string) {
  const length = [...password].length;
  if (length < 15 || length > 128 || Buffer.byteLength(password, 'utf8') > 512)
    throw new IdentityError(400);
}
export async function hashPassword(password: string) {
  validatePassword(password);
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `scrypt-v1$${salt.toString('hex')}$${hash.toString('hex')}`;
}
// Unknown accounts still perform the same expensive derivation.
const dummy = `scrypt-v1$${'00'.repeat(16)}$${'00'.repeat(64)}`;
export async function verifyPassword(
  password: string,
  stored: string | undefined,
) {
  const encoded = stored ?? dummy;
  const parts = encoded.split('$');
  if (
    parts.length !== 3 ||
    parts[0] !== 'scrypt-v1' ||
    !/^[0-9a-f]{32}$/.test(parts[1]!) ||
    !/^[0-9a-f]{128}$/.test(parts[2]!)
  )
    return false;
  const actual = await derive(password, Buffer.from(parts[1]!, 'hex'));
  return (
    timingSafeEqual(actual, Buffer.from(parts[2]!, 'hex')) &&
    stored !== undefined
  );
}
