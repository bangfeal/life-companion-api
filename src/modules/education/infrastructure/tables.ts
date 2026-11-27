import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  timestamp,
  varchar,
  integer,
  text,
  doublePrecision,
  index,
  unique,
  check,
  foreignKey,
} from 'drizzle-orm/pg-core';
export const examinations = pgTable(
  'examinations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    subject: varchar('subject', { length: 100 }).notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    timeZone: varchar('time_zone', { length: 100 }).notNull(),
    durationMinutes: integer('duration_minutes'),
    status: varchar('status', { length: 20 }).notNull().default('scheduled'),
    score: doublePrecision('score'),
    maxScore: doublePrecision('max_score'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('exams_id_owner_unique').on(t.id, t.userId),
    index('exams_owner_scheduled_idx').on(t.userId, t.scheduledAt, t.id),
    check(
      'exams_text_valid',
      sql`length(btrim(${t.title}))>0 AND length(btrim(${t.subject}))>0`,
    ),
    check(
      'exams_status_valid',
      sql`${t.status} IN ('scheduled','completed','canceled')`,
    ),
    check(
      'exams_duration_valid',
      sql`${t.durationMinutes} IS NULL OR ${t.durationMinutes} BETWEEN 1 AND 1440`,
    ),
    check(
      'exams_score_valid',
      sql`(${t.score} IS NULL AND ${t.maxScore} IS NULL) OR (${t.score} IS NOT NULL AND ${t.maxScore} IS NOT NULL AND ${t.status}='completed' AND ${t.score}>=0 AND ${t.score}<=${t.maxScore} AND ${t.maxScore}>0 AND ${t.maxScore}<=1e12)`,
    ),
  ],
);
export const studySessions = pgTable(
  'study_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    subject: varchar('subject', { length: 100 }).notNull(),
    activity: varchar('activity', { length: 20 }).notNull().default('practice'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    timeZone: varchar('time_zone', { length: 100 }).notNull(),
    breakMinutes: integer('break_minutes').notNull().default(0),
    taskId: uuid('task_id'),
    examinationId: uuid('examination_id'),
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
    index('study_owner_end_idx').on(t.userId, t.endsAt, t.id),
    index('study_task_owner_idx').on(t.taskId, t.userId),
    index('study_exam_owner_idx').on(t.examinationId, t.userId),
    check('study_subject_nonempty', sql`length(btrim(${t.subject}))>0`),
    check(
      'study_activity_valid',
      sql`${t.activity} IN ('reading','practice','review','lecture')`,
    ),
    check(
      'study_interval_valid',
      sql`${t.endsAt}>${t.startsAt} AND ${t.endsAt}<=${t.startsAt}+interval '24 hours'`,
    ),
    check(
      'study_break_valid',
      sql`${t.breakMinutes}>=0 AND ${t.breakMinutes}<extract(epoch from (${t.endsAt}-${t.startsAt}))/60`,
    ),
    check(
      'study_notes_length',
      sql`${t.notes} IS NULL OR length(${t.notes}) BETWEEN 1 AND 1000`,
    ),
    check('study_manual_provenance', sql`${t.provenance}='manual'`),
    foreignKey({
      name: 'study_owned_exam_fk',
      columns: [t.examinationId, t.userId],
      foreignColumns: [examinations.id, examinations.userId],
    }),
  ],
);
