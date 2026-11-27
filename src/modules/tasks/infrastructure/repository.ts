import { databaseWrite } from '../../../infrastructure/database/write.js';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import type { createDatabase } from '../../../infrastructure/database/client.js';
import type { Repository } from '../application/ports.js';
import type { Task } from '../domain/model.js';
import { table } from './tables.js';
type Database = ReturnType<typeof createDatabase>['db'];
function toDto(row: typeof table.$inferSelect): Task {
  const { userId, ...values } = row;
  void userId;
  return {
    ...values,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    dueAt: row.dueAt?.toISOString() ?? null,
    status: row.status as Task['status'],
  };
}
export function createRepository(db: Database): Repository {
  return {
    async create(userId, input) {
      return databaseWrite(async () => {
        const values = {
          ...input,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
        };
        const [row] = await db
          .insert(table)
          .values({ ...values, userId })
          .returning();
        return toDto(row!);
      });
    },
    async list(userId, query) {
      const predicates = [eq(table.userId, userId)];
      if (query.status) predicates.push(eq(table.status, query.status));
      if (query.goalId) predicates.push(eq(table.goalId, query.goalId));
      if (query.dueFrom)
        predicates.push(gte(table.dueAt, new Date(query.dueFrom)));
      if (query.dueTo) predicates.push(lt(table.dueAt, new Date(query.dueTo)));
      return (
        await db
          .select()
          .from(table)
          .where(and(...predicates))
          .orderBy(desc(table.createdAt), desc(table.id))
          .limit(query.limit + 1)
          .offset(query.offset)
      ).map(toDto);
    },
    async get(userId, id) {
      const [row] = await db
        .select()
        .from(table)
        .where(and(eq(table.userId, userId), eq(table.id, id)));
      return row ? toDto(row) : undefined;
    },
    async update(userId, id, patch) {
      return databaseWrite(async () => {
        const { dueAt, ...rest } = patch;
        const values = {
          ...rest,
          ...(dueAt !== undefined
            ? { dueAt: dueAt === null ? null : new Date(dueAt) }
            : {}),
        };
        const [row] = await db
          .update(table)
          .set({ ...values, updatedAt: new Date() })
          .where(and(eq(table.userId, userId), eq(table.id, id)))
          .returning();
        return row ? toDto(row) : undefined;
      });
    },
    async delete(userId, id) {
      return (
        (
          await db
            .delete(table)
            .where(and(eq(table.userId, userId), eq(table.id, id)))
            .returning({ id: table.id })
        ).length > 0
      );
    },
  };
}
