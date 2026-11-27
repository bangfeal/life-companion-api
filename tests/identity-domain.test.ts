import { describe, expect, it } from 'vitest';
import {
  normalizeEmail,
  validateProfile,
} from '../src/modules/identity/domain/profile.js';
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from '../src/modules/identity/domain/password.js';

describe('identity domain', () => {
  it('bounds concurrent password work instead of allocating unbounded memory', async () => {
    const results = await Promise.allSettled([
      hashPassword('long valid password one'),
      hashPassword('long valid password two'),
      hashPassword('long valid password three'),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(2);
    const rejection = results.find((result) => result.status === 'rejected');
    expect(
      rejection?.status === 'rejected' && rejection.reason.statusCode,
    ).toBe(503);
  }, 15000);
  it('normalizes email and rejects malformed identities', () => {
    expect(normalizeEmail(' Alice@Example.COM ')).toBe('alice@example.com');
    expect(() => normalizeEmail('not-an-email')).toThrow();
  });
  it('validates IANA timezones and trims names without changing omitted fields', () => {
    expect(
      validateProfile({ displayName: ' Alice ', timeZone: 'Europe/Madrid' }),
    ).toEqual({ displayName: 'Alice', timeZone: 'Europe/Madrid' });
    expect(validateProfile({ displayName: null })).toEqual({
      displayName: null,
    });
    for (const patch of [
      {},
      { displayName: '   ' },
      { timeZone: 'Mars/Base' },
      { timeZone: '+02:00' },
      { userId: 'someone-else' },
    ])
      expect(() => validateProfile(patch)).toThrow();
  });
  it('rejects short and excessively long passwords without truncation', () => {
    for (const password of ['short', 'a'.repeat(129)])
      expect(() => validatePassword(password)).toThrow();
    expect(() => validatePassword(' spaces are allowed ')).not.toThrow();
  });
  it('uses salted, versioned scrypt hashes and rejects incorrect passwords', async () => {
    const password = 'a sufficiently long password';
    const stored = await hashPassword(password);
    expect(stored).toMatch(/^scrypt-v1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(stored).not.toContain(password);
    expect(await verifyPassword(password, stored)).toBe(true);
    expect(await verifyPassword('a different long password', stored)).toBe(
      false,
    );
    expect(await verifyPassword(password, undefined)).toBe(false);
  }, 15000);
});
