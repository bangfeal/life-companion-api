import { and, desc, eq, gt, gte, lt } from 'drizzle-orm';
import type { createDatabase } from '../../../infrastructure/database/client.js';
import { databaseWrite } from '../../../infrastructure/database/write.js';
import { validateSleep, type SleepSession } from '../domain/model.js';
import type { SleepRepository } from '../application/ports.js';
import { sleepSessions as table } from './tables.js';
type Database = ReturnType<typeof createDatabase>['db'];
function dto(row: typeof table.$inferSelect): SleepSession {
  return {
    id: row.id,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    timeZone: row.timeZone,
    awakeMinutes: row.awakeMinutes,
    kind: row.kind as 'main' | 'nap',
    quality: row.quality,
    notes: row.notes,
    provenance: 'manual',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export function createRepository(db: Database): SleepRepository {
  return {
    async create(userId, input) {
      return databaseWrite(async () => {
        const [row] = await db
          .insert(table)
          .values({
            ...input,
            userId,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
          })
          .returning();
        return dto(row!);
      });
    },
    async get(userId, id) {
      const [row] = await db
        .select()
        .from(table)
        .where(and(eq(table.userId, userId), eq(table.id, id)));
      return row ? dto(row) : undefined;
    },
    async list(userId, query) {
      const predicates = [eq(table.userId, userId)];
      if (query.from) predicates.push(gt(table.endsAt, new Date(query.from)));
      if (query.to) predicates.push(lt(table.startsAt, new Date(query.to)));
      if (query.kind) predicates.push(eq(table.kind, query.kind));
      return (
        await db
          .select()
          .from(table)
          .where(and(...predicates))
          .orderBy(desc(table.endsAt), desc(table.id))
          .limit(query.limit + 1)
          .offset(query.offset)
      ).map(dto);
    },
    async update(userId, id, patch) {
      return databaseWrite(() =>
        db.transaction(async (tx) => {
          const [row] = await tx
            .select()
            .from(table)
            .where(and(eq(table.userId, userId), eq(table.id, id)))
            .for('update');
          if (!row) return undefined;
          const old = dto(row);
          const merged = validateSleep({
            startsAt: old.startsAt,
            endsAt: old.endsAt,
            timeZone: old.timeZone,
            awakeMinutes: old.awakeMinutes,
            kind: old.kind,
            quality: old.quality,
            notes: old.notes,
            ...patch,
          });
          const [updated] = await tx
            .update(table)
            .set({
              ...merged,
              startsAt: new Date(merged.startsAt!),
              endsAt: new Date(merged.endsAt!),
              updatedAt: new Date(),
            })
            .where(and(eq(table.userId, userId), eq(table.id, id)))
            .returning();
          return dto(updated!);
        }),
      );
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
    async summaryRows(userId, from, to) {
      return (
        await db
          .select()
          .from(table)
          .where(
            and(
              eq(table.userId, userId),
              gte(table.endsAt, new Date(from)),
              lt(table.endsAt, new Date(to)),
            ),
          )
          .orderBy(table.endsAt, table.id)
          .limit(10001)
      ).map(dto);
    },
  };
}
