import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  check,
  index,
  unique,
  boolean,
  date,
  primaryKey,
} from 'drizzle-orm/pg-core';
export const table = pgTable(
  'habits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    goalId: uuid('goal_id'),
    timeZone: varchar('time_zone', { length: 100 }).notNull().default('UTC'),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('habits_goal_owner_idx').on(t.goalId, t.userId),
    index('habits_owner_created_idx').on(t.userId, t.createdAt, t.id),
    unique('habits_id_owner_unique').on(t.id, t.userId),
    check('habits_title_nonempty', sql`length(btrim(${t.title})) > 0`),
  ],
);

export const habitLogs = pgTable(
  'habit_logs',
  {
    habitId: uuid('habit_id')
      .notNull()
      .references(() => table.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    completed: boolean('completed').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.habitId, t.date] })],
);
