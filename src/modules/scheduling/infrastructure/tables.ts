import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  check,
  index,
  text,
} from 'drizzle-orm/pg-core';
export const table = pgTable(
  'schedule_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    taskId: uuid('task_id'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    timeZone: varchar('time_zone', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('events_task_owner_idx').on(t.taskId, t.userId),
    index('events_owner_start_idx').on(t.userId, t.startsAt, t.id),
    index('scheduling_owner_created_idx').on(t.userId, t.createdAt, t.id),
    check('events_title_nonempty', sql`length(btrim(${t.title})) > 0`),
    check(
      'events_description_length',
      sql`${t.description} IS NULL OR length(${t.description}) BETWEEN 1 AND 2000`,
    ),
    check('events_interval_valid', sql`${t.endsAt} > ${t.startsAt}`),
  ],
);
