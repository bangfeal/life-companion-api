import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  timestamp,
  varchar,
  integer,
  text,
  index,
  check,
} from 'drizzle-orm/pg-core';
export const sleepSessions = pgTable(
  'sleep_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    timeZone: varchar('time_zone', { length: 100 }).notNull(),
    awakeMinutes: integer('awake_minutes').notNull().default(0),
    kind: varchar('kind', { length: 10 }).notNull().default('main'),
    quality: integer('quality'),
    notes: text('notes'),
    provenance: varchar('provenance', { length: 10 })
      .notNull()
      .default('manual'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('sleep_owner_end_idx').on(t.userId, t.endsAt, t.id),
    check(
      'sleep_interval_valid',
      sql`${t.endsAt}>${t.startsAt} AND ${t.endsAt}<=${t.startsAt}+interval '48 hours'`,
    ),
    check(
      'sleep_awake_valid',
      sql`${t.awakeMinutes}>=0 AND ${t.awakeMinutes} < extract(epoch from (${t.endsAt}-${t.startsAt}))/60`,
    ),
    check('sleep_kind_valid', sql`${t.kind} IN ('main','nap')`),
    check(
      'sleep_quality_valid',
      sql`${t.quality} IS NULL OR ${t.quality} BETWEEN 1 AND 5`,
    ),
    check(
      'sleep_notes_length',
      sql`${t.notes} IS NULL OR length(${t.notes}) BETWEEN 1 AND 1000`,
    ),
    check('sleep_manual_provenance', sql`${t.provenance}='manual'`),
  ],
);
