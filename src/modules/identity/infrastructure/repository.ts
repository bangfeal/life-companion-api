import { and, eq, gt, lte } from 'drizzle-orm';
import type { createDatabase } from '../../../infrastructure/database/client.js';
import type { IdentityRepository } from '../application/ports.js';
import { users, userProfiles, authSessions } from './tables.js';
export type Database = ReturnType<typeof createDatabase>['db'];
const publicFields = {
  id: users.id,
  email: users.email,
  createdAt: users.createdAt,
  displayName: userProfiles.displayName,
  timeZone: userProfiles.timeZone,
};
export function identityRepository(db: Database): IdentityRepository {
  return {
    async register(email: string, passwordHash: string) {
      return db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ email, passwordHash })
          .onConflictDoNothing({ target: users.email })
          .returning({ id: users.id });
        if (!user) return undefined;
        await tx.insert(userProfiles).values({ userId: user.id });
        return user.id;
      });
    },
    async credentials(email: string) {
      const [user] = await db
        .select({ id: users.id, passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.email, email));
      return user;
    },
    async createSession(
      userId: string,
      tokenHash: string,
      now: Date,
      expiresAt: Date,
    ) {
      await db.transaction(async (tx) => {
        await tx.delete(authSessions).where(lte(authSessions.expiresAt, now));
        await tx
          .insert(authSessions)
          .values({ userId, tokenHash, createdAt: now, expiresAt });
      });
    },
    async session(tokenHash: string, now: Date) {
      const [session] = await db
        .select({ userId: authSessions.userId })
        .from(authSessions)
        .where(
          and(
            eq(authSessions.tokenHash, tokenHash),
            gt(authSessions.expiresAt, now),
          ),
        );
      return session;
    },
    async me(userId: string) {
      const [user] = await db
        .select(publicFields)
        .from(users)
        .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(eq(users.id, userId));
      return user;
    },
    async updateProfile(
      userId: string,
      tokenHash: string,
      now: Date,
      patch: { displayName?: string | null; timeZone?: string },
    ) {
      // Session validity is rechecked at the write, not only by the caller.
      const liveSession = db
        .select({ userId: authSessions.userId })
        .from(authSessions)
        .where(
          and(
            eq(authSessions.tokenHash, tokenHash),
            eq(authSessions.userId, userId),
            gt(authSessions.expiresAt, now),
          ),
        );
      const updated = await db
        .update(userProfiles)
        .set({ ...patch, updatedAt: now })
        .where(
          and(
            eq(userProfiles.userId, userId),
            eq(userProfiles.userId, liveSession),
          ),
        )
        .returning({ userId: userProfiles.userId });
      return updated.length > 0;
    },
    async revoke(tokenHash: string) {
      await db
        .delete(authSessions)
        .where(eq(authSessions.tokenHash, tokenHash));
    },
  };
}
