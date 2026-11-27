import { databaseWrite } from '../../../infrastructure/database/write.js';
import { and, eq, gt, lt, asc } from 'drizzle-orm';
import type { createDatabase } from '../../../infrastructure/database/client.js';
import type { Repository } from '../application/ports.js';
import { validateEvent, type Event } from '../domain/model.js';
import { table } from './tables.js';
type Database = ReturnType<typeof createDatabase>['db'];
function toDto(row: typeof table.$inferSelect): Event {
  const { userId, ...values } = row;
  void userId;
  return {
    ...values,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
  };
}
export function createRepository(db: Database): Repository {
  return {
    async create(userId, input) {
      return databaseWrite(async () => {
        const values = {
          ...input,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
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
      if (query.taskId) predicates.push(eq(table.taskId, query.taskId));
      if (query.from) predicates.push(gt(table.endsAt, new Date(query.from)));
      if (query.to) predicates.push(lt(table.startsAt, new Date(query.to)));
      return (
        await db
          .select()
          .from(table)
          .where(and(...predicates))
          .orderBy(asc(table.startsAt), asc(table.id))
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
        return db.transaction(async (tx) => {
          const [existing] = await tx
            .select()
            .from(table)
            .where(and(eq(table.userId, userId), eq(table.id, id)))
            .for('update');
          if (!existing) return undefined;
          const merged = validateEvent({
            title: existing.title,
            description: existing.description,
            taskId: existing.taskId,
            startsAt: existing.startsAt.toISOString(),
            endsAt: existing.endsAt.toISOString(),
            timeZone: existing.timeZone,
            ...patch,
          });
          const { startsAt, endsAt, ...rest } = patch;
          void startsAt;
          void endsAt;
          const values = {
            ...rest,
            startsAt: new Date(merged.startsAt!),
            endsAt: new Date(merged.endsAt!),
          };
          const [row] = await tx
            .update(table)
            .set({ ...values, updatedAt: new Date() })
            .where(and(eq(table.userId, userId), eq(table.id, id)))
            .returning();
          return toDto(row!);
        });
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
