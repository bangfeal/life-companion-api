import { databaseWrite } from '../../../infrastructure/database/write.js';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { createDatabase } from '../../../infrastructure/database/client.js';
import type { Repository } from '../application/ports.js';
import type { Habit } from '../domain/model.js';
import { ApplicationError } from '../../../shared/domain/validation.js';
import { table, habitLogs } from './tables.js';
type Database = ReturnType<typeof createDatabase>['db'];
function toDto(row: typeof table.$inferSelect): Habit {
  const { userId, ...values } = row;
  void userId;
  return {
    ...values,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export function createRepository(db: Database): Repository {
  return {
    async log(userId, id, input) {
      return db.transaction(async (tx) => {
        const [parent] = await tx
          .select({ id: table.id, archived: table.archived })
          .from(table)
          .where(and(eq(table.id, id), eq(table.userId, userId)))
          .for('update');
        if (!parent) return undefined;
        if (parent.archived) throw new ApplicationError(409);
        const [row] = await tx
          .insert(habitLogs)
          .values({ habitId: id, ...input })
          .onConflictDoUpdate({
            target: [habitLogs.habitId, habitLogs.date],
            set: { completed: input.completed, updatedAt: new Date() },
          })
          .returning();
        return {
          date: row!.date,
          completed: row!.completed,
          createdAt: row!.createdAt.toISOString(),
          updatedAt: row!.updatedAt.toISOString(),
        };
      });
    },
    async logs(userId, id, query) {
      const [parent] = await db
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.id, id), eq(table.userId, userId)));
      if (!parent) return undefined;
      const predicates = [eq(habitLogs.habitId, id), eq(table.userId, userId)];
      if (query.fromDate) predicates.push(gte(habitLogs.date, query.fromDate));
      if (query.toDate) predicates.push(lte(habitLogs.date, query.toDate));
      const rows = await db
        .select({
          date: habitLogs.date,
          completed: habitLogs.completed,
          createdAt: habitLogs.createdAt,
          updatedAt: habitLogs.updatedAt,
        })
        .from(habitLogs)
        .innerJoin(table, eq(table.id, habitLogs.habitId))
        .where(and(...predicates))
        .orderBy(desc(habitLogs.date))
        .limit(query.limit + 1)
        .offset(query.offset);
      return rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
    async create(userId, input) {
      return databaseWrite(async () => {
        const values = { ...input };
        const [row] = await db
          .insert(table)
          .values({ ...values, userId })
          .returning();
        return toDto(row!);
      });
    },
    async list(userId, query) {
      const predicates = [eq(table.userId, userId)];
      if (query.archived !== undefined)
        predicates.push(eq(table.archived, query.archived));
      if (query.goalId) predicates.push(eq(table.goalId, query.goalId));
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
        const values = { ...patch };
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
