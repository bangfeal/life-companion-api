import { createHash, randomBytes } from 'node:crypto';
import type { IdentityRepository } from './ports.js';
import { IdentityError } from '../domain/errors.js';
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from '../domain/password.js';
import {
  normalizeEmail,
  validateProfile,
  type ProfilePatch,
} from '../domain/profile.js';
const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export function createIdentityService(
  repository: IdentityRepository,
  now: () => Date = () => new Date(),
) {
  async function authenticate(token: string | undefined) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new IdentityError(401);
    const session = await repository.session(tokenHash(token), now());
    if (!session) throw new IdentityError(401);
    return { userId: session.userId, hash: tokenHash(token) };
  }
  async function meFor(userId: string) {
    const user = await repository.me(userId);
    if (!user) throw new IdentityError(401);
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      profile: { displayName: user.displayName, timeZone: user.timeZone },
    };
  }
  async function issue(userId: string) {
    const accessToken = randomBytes(32).toString('base64url');
    const issuedAt = now();
    const expiresAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    await repository.createSession(
      userId,
      tokenHash(accessToken),
      issuedAt,
      expiresAt,
    );
    return {
      accessToken,
      tokenType: 'Bearer' as const,
      expiresAt: expiresAt.toISOString(),
      user: await meFor(userId),
    };
  }
  return {
    async register(input: { email: string; password: string }) {
      const email = normalizeEmail(input.email);
      const passwordHash = await hashPassword(input.password);
      const userId = await repository.register(email, passwordHash);
      if (!userId) throw new IdentityError(409);
      return issue(userId);
    },
    async login(input: { email: string; password: string }) {
      const email = normalizeEmail(input.email);
      validatePassword(input.password);
      const user = await repository.credentials(email);
      if (!(await verifyPassword(input.password, user?.passwordHash)))
        throw new IdentityError(401);
      return issue(user!.id);
    },
    async me(token: string | undefined) {
      const session = await authenticate(token);
      return meFor(session.userId);
    },
    async updateProfile(token: string | undefined, patch: ProfilePatch) {
      const session = await authenticate(token);
      const changes = validateProfile(patch);
      if (
        !(await repository.updateProfile(
          session.userId,
          session.hash,
          now(),
          changes,
        ))
      )
        throw new IdentityError(401);
      return meFor(session.userId);
    },
    async logout(token: string | undefined) {
      const session = await authenticate(token);
      await repository.revoke(session.hash);
    },
  };
}
export type IdentityService = ReturnType<typeof createIdentityService>;
