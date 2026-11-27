import { IdentityError } from './errors.js';
export interface ProfilePatch {
  displayName?: string | null;
  timeZone?: string;
}
export function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    throw new IdentityError(400);
  return normalized;
}
export function validateProfile(patch: ProfilePatch): ProfilePatch {
  const keys = Object.keys(patch);
  if (
    !keys.length ||
    keys.some((key) => !['displayName', 'timeZone'].includes(key))
  )
    throw new IdentityError(400);
  const result: ProfilePatch = {};
  if (patch.displayName !== undefined) {
    if (
      patch.displayName !== null &&
      (typeof patch.displayName !== 'string' ||
        !patch.displayName.trim() ||
        [...patch.displayName].length > 100)
    )
      throw new IdentityError(400);
    result.displayName =
      patch.displayName === null ? null : patch.displayName.trim();
  }
  if (patch.timeZone !== undefined) {
    try {
      if (
        typeof patch.timeZone !== 'string' ||
        patch.timeZone.length > 100 ||
        (patch.timeZone !== 'UTC' && !patch.timeZone.includes('/'))
      )
        throw new Error();
      new Intl.DateTimeFormat('en', { timeZone: patch.timeZone });
    } catch {
      throw new IdentityError(400);
    }
    result.timeZone = patch.timeZone;
  }
  return result;
}
