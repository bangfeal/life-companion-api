import type { ProfilePatch } from '../domain/profile.js';
export interface IdentityRepository {
  register(email: string, passwordHash: string): Promise<string | undefined>;
  credentials(
    email: string,
  ): Promise<{ id: string; passwordHash: string } | undefined>;
  createSession(
    userId: string,
    tokenHash: string,
    now: Date,
    expiresAt: Date,
  ): Promise<void>;
  session(
    tokenHash: string,
    now: Date,
  ): Promise<{ userId: string } | undefined>;
  me(userId: string): Promise<
    | {
        id: string;
        email: string;
        createdAt: Date;
        displayName: string | null;
        timeZone: string;
      }
    | undefined
  >;
  updateProfile(
    userId: string,
    tokenHash: string,
    now: Date,
    patch: ProfilePatch,
  ): Promise<boolean>;
  revoke(tokenHash: string): Promise<void>;
}
