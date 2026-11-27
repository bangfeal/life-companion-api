import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  doublePrecision,
  timestamp,
  date,
  check,
  index,
  unique,
  primaryKey,
} from 'drizzle-orm/pg-core';
export const goals = pgTable(
  'goals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    targetValue: doublePrecision('target_value').notNull(),
    currentValue: doublePrecision('current_value').notNull().default(0),
    unit: varchar('unit', { length: 50 }).notNull(),
    dueDate: date('due_date'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('goals_id_owner_unique').on(t.id, t.userId),
    index('goals_owner_created_idx').on(t.userId, t.createdAt, t.id),
    check('goals_title_nonempty', sql`length(btrim(${t.title})) > 0`),
    check('goals_unit_nonempty', sql`length(btrim(${t.unit})) > 0`),
    check(
      'goals_description_length',
      sql`${t.description} IS NULL OR length(${t.description}) BETWEEN 1 AND 2000`,
    ),
    check(
      'goals_values_valid',
      sql`${t.targetValue} > 0 AND ${t.targetValue} <= 1e12 AND ${t.currentValue} >= 0 AND ${t.currentValue} <= 1e12`,
    ),
    check(
      'goals_status_valid',
      sql`${t.status} IN ('active','completed','archived')`,
    ),
  ],
);
export const goalDomains = pgTable(
  'goal_domains',
  {
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    domain: varchar('domain', { length: 30 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.goalId, t.domain] }),
    check('goal_domain_valid', sql`${t.domain} IN ('sleep','education')`),
  ],
);
