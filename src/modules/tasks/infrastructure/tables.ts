import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  check,
  index,
  unique,
  text,
} from 'drizzle-orm/pg-core';
export const table = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    goalId: uuid('goal_id'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    status: varchar('status', { length: 20 }).notNull().default('todo'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('tasks_goal_owner_idx').on(t.goalId, t.userId),
    index('tasks_owner_due_idx').on(t.userId, t.dueAt, t.id),
    index('tasks_owner_created_idx').on(t.userId, t.createdAt, t.id),
    unique('tasks_id_owner_unique').on(t.id, t.userId),
    check('tasks_title_nonempty', sql`length(btrim(${t.title})) > 0`),
    check(
      'tasks_description_length',
      sql`${t.description} IS NULL OR length(${t.description}) BETWEEN 1 AND 2000`,
    ),
    check('tasks_status_valid', sql`${t.status} IN ('todo','done','canceled')`),
  ],
);
