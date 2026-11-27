import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  check,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 254 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'users_email_normalized',
      sql`${table.email} = lower(btrim(${table.email}))`,
    ),
  ],
);

export const userProfiles = pgTable(
  'user_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: varchar('display_name', { length: 100 }),
    timeZone: varchar('time_zone', { length: 100 }).notNull().default('UTC'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'profiles_display_name_nonempty',
      sql`${table.displayName} IS NULL OR length(btrim(${table.displayName})) > 0`,
    ),
  ],
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('sessions_user_idx').on(table.userId),
    index('sessions_expiry_idx').on(table.expiresAt),
    check(
      'sessions_expiry_after_creation',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check('sessions_hash_format', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
  ],
);
