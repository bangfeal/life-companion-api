import { databaseWrite } from '../../../infrastructure/database/write.js';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { createDatabase } from '../../../infrastructure/database/client.js';
import type { GoalRepository } from '../application/ports.js';
import type { Goal, GoalPatch } from '../domain/model.js';
import type { Domain } from '../../../shared/domain/validation.js';
import { goals, goalDomains } from './tables.js';
type Database = ReturnType<typeof createDatabase>['db'];
type Row = typeof goals.$inferSelect;
async function hydrate(
  db: Pick<Database, 'select'>,
  rows: Row[],
): Promise<Goal[]> {
  const associations = rows.length
    ? await db
        .select()
        .from(goalDomains)
        .where(
          inArray(
            goalDomains.goalId,
            rows.map((row) => row.id),
          ),
        )
    : [];
  return rows.map(({ userId: _owner, ...row }) => {
    void _owner;
    return {
      ...row,
      status: row.status as Goal['status'],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      domains: associations
        .filter((a) => a.goalId === row.id)
        .map((a) => a.domain as Domain)
        .sort(),
    };
  });
}
export function goalsRepository(db: Database): GoalRepository {
  return {
    async create(userId, input) {
      return databaseWrite(async () => {
        return db.transaction(async (tx) => {
          const { domains = [], ...values } = input;
          const [row] = await tx
            .insert(goals)
            .values({ ...values, userId })
            .returning();
          if (domains.length)
            await tx
              .insert(goalDomains)
              .values(domains.map((domain) => ({ goalId: row!.id, domain })));
          return (await hydrate(tx, [row!]))[0]!;
        });
      });
    },
    async list(userId, query) {
      const predicates = [eq(goals.userId, userId)];
      if (query.status) predicates.push(eq(goals.status, query.status));
      if (query.domain)
        predicates.push(
          sql`exists (select 1 from ${goalDomains} where ${goalDomains.goalId} = ${goals.id} and ${goalDomains.domain} = ${query.domain})`,
        );
      return hydrate(
        db,
        await db
          .select()
          .from(goals)
          .where(and(...predicates))
          .orderBy(desc(goals.createdAt), desc(goals.id))
          .limit(query.limit + 1)
          .offset(query.offset),
      );
    },
    async get(userId, id) {
      const rows = await db
        .select()
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.id, id)));
      return (await hydrate(db, rows))[0];
    },
    async update(userId, id, patch: GoalPatch) {
      return databaseWrite(async () => {
        return db.transaction(async (tx) => {
          const { domains, ...values } = patch;
          const [row] = await tx
            .update(goals)
            .set({ ...values, updatedAt: new Date() })
            .where(and(eq(goals.userId, userId), eq(goals.id, id)))
            .returning();
          if (!row) return undefined;
          if (domains !== undefined) {
            await tx.delete(goalDomains).where(eq(goalDomains.goalId, id));
            if (domains.length)
              await tx
                .insert(goalDomains)
                .values(domains.map((domain) => ({ goalId: id, domain })));
          }
          return (await hydrate(tx, [row]))[0];
        });
      });
    },
    async delete(userId, id) {
      return (
        (
          await db
            .delete(goals)
            .where(and(eq(goals.userId, userId), eq(goals.id, id)))
            .returning({ id: goals.id })
        ).length > 0
      );
    },
  };
}
