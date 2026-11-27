import { and, desc, eq, gt, gte, lt } from 'drizzle-orm';
import type { createDatabase } from '../../../infrastructure/database/client.js';
import { databaseWrite } from '../../../infrastructure/database/write.js';
import {
  validateStudy,
  validateExam,
  type StudySession,
  type Examination,
} from '../domain/model.js';
import type { EducationRepository } from '../application/ports.js';
import { studySessions, examinations } from './tables.js';
type Database = ReturnType<typeof createDatabase>['db'];
function sessionDto(row: typeof studySessions.$inferSelect): StudySession {
  return {
    id: row.id,
    subject: row.subject,
    activity: row.activity as StudySession['activity'],
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    timeZone: row.timeZone,
    breakMinutes: row.breakMinutes,
    taskId: row.taskId,
    examinationId: row.examinationId,
    notes: row.notes,
    provenance: 'manual',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
function examDto(row: typeof examinations.$inferSelect): Examination {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    scheduledAt: row.scheduledAt.toISOString(),
    timeZone: row.timeZone,
    durationMinutes: row.durationMinutes,
    status: row.status as Examination['status'],
    score: row.score,
    maxScore: row.maxScore,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export function createRepository(db: Database): EducationRepository {
  return {
    async createSession(userId, input) {
      return databaseWrite(async () => {
        const table = studySessions;
        const [row] = await db
          .insert(table)
          .values({
            ...input,
            userId,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
          })
          .returning();
        return sessionDto(row!);
      });
    },
    async getSession(userId, id) {
      const table = studySessions;
      const [row] = await db
        .select()
        .from(table)
        .where(and(eq(table.userId, userId), eq(table.id, id)));
      return row ? sessionDto(row) : undefined;
    },
    async listSessions(userId, query) {
      const table = studySessions;
      const predicates = [eq(table.userId, userId)];
      if (query.subject) predicates.push(eq(table.subject, query.subject));
      if (query.taskId) predicates.push(eq(table.taskId, query.taskId));
      if (query.examinationId)
        predicates.push(eq(table.examinationId, query.examinationId));
      if (query.from) predicates.push(gt(table.endsAt, new Date(query.from)));
      if (query.to) predicates.push(lt(table.startsAt, new Date(query.to)));
      return (
        await db
          .select()
          .from(table)
          .where(and(...predicates))
          .orderBy(desc(table.endsAt), desc(table.id))
          .limit(query.limit + 1)
          .offset(query.offset)
      ).map(sessionDto);
    },
    async updateSession(userId, id, patch) {
      return databaseWrite(() =>
        db.transaction(async (tx) => {
          const table = studySessions;
          const [row] = await tx
            .select()
            .from(table)
            .where(and(eq(table.userId, userId), eq(table.id, id)))
            .for('update');
          if (!row) return undefined;
          const old = sessionDto(row);
          const merged = validateStudy({
            subject: old.subject,
            activity: old.activity,
            startsAt: old.startsAt,
            endsAt: old.endsAt,
            timeZone: old.timeZone,
            breakMinutes: old.breakMinutes,
            taskId: old.taskId,
            examinationId: old.examinationId,
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
          return sessionDto(updated!);
        }),
      );
    },
    async deleteSession(userId, id) {
      const table = studySessions;
      return (
        (
          await db
            .delete(table)
            .where(and(eq(table.userId, userId), eq(table.id, id)))
            .returning({ id: table.id })
        ).length > 0
      );
    },

    async createExam(userId, input) {
      return databaseWrite(async () => {
        const table = examinations;
        const [row] = await db
          .insert(table)
          .values({
            ...input,
            userId,
            scheduledAt: new Date(input.scheduledAt),
          })
          .returning();
        return examDto(row!);
      });
    },
    async getExam(userId, id) {
      const table = examinations;
      const [row] = await db
        .select()
        .from(table)
        .where(and(eq(table.userId, userId), eq(table.id, id)));
      return row ? examDto(row) : undefined;
    },
    async listExams(userId, query) {
      const table = examinations;
      const predicates = [eq(table.userId, userId)];
      if (query.subject) predicates.push(eq(table.subject, query.subject));
      if (query.status) predicates.push(eq(table.status, query.status));
      if (query.from)
        predicates.push(gte(table.scheduledAt, new Date(query.from)));
      if (query.to) predicates.push(lt(table.scheduledAt, new Date(query.to)));
      return (
        await db
          .select()
          .from(table)
          .where(and(...predicates))
          .orderBy(desc(table.scheduledAt), desc(table.id))
          .limit(query.limit + 1)
          .offset(query.offset)
      ).map(examDto);
    },
    async updateExam(userId, id, patch) {
      return databaseWrite(() =>
        db.transaction(async (tx) => {
          const table = examinations;
          const [row] = await tx
            .select()
            .from(table)
            .where(and(eq(table.userId, userId), eq(table.id, id)))
            .for('update');
          if (!row) return undefined;
          const old = examDto(row);
          const merged = validateExam({
            title: old.title,
            subject: old.subject,
            scheduledAt: old.scheduledAt,
            timeZone: old.timeZone,
            durationMinutes: old.durationMinutes,
            status: old.status,
            score: old.score,
            maxScore: old.maxScore,
            ...patch,
          });
          const [updated] = await tx
            .update(table)
            .set({
              ...merged,
              scheduledAt: new Date(merged.scheduledAt!),
              updatedAt: new Date(),
            })
            .where(and(eq(table.userId, userId), eq(table.id, id)))
            .returning();
          return examDto(updated!);
        }),
      );
    },
    async deleteExam(userId, id) {
      const table = examinations;
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
      const [sessions, exams] = await Promise.all([
        db
          .select()
          .from(studySessions)
          .where(
            and(
              eq(studySessions.userId, userId),
              gte(studySessions.endsAt, new Date(from)),
              lt(studySessions.endsAt, new Date(to)),
            ),
          )
          .orderBy(studySessions.endsAt, studySessions.id)
          .limit(10001),
        db
          .select()
          .from(examinations)
          .where(
            and(
              eq(examinations.userId, userId),
              gte(examinations.scheduledAt, new Date(from)),
              lt(examinations.scheduledAt, new Date(to)),
            ),
          )
          .orderBy(examinations.scheduledAt, examinations.id)
          .limit(10001),
      ]);
      return {
        sessions: sessions.map(sessionDto),
        examinations: exams.map(examDto),
      };
    },
  };
}
