import {
  ApplicationError,
  amount,
  choice,
  fields,
  instant,
  text,
  timeZone,
  uuid,
  type PageQuery,
} from '../../../shared/domain/validation.js';
import {
  elapsedMinutes,
  localDate,
  observedInterval,
  round,
} from '../../../shared/domain/time.js';
export type Activity = 'reading' | 'practice' | 'review' | 'lecture';
export interface StudyInput {
  subject: string;
  activity?: Activity;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  breakMinutes?: number;
  taskId?: string | null;
  examinationId?: string | null;
  notes?: string | null;
}
export type StudyPatch = Partial<StudyInput>;
export interface StudySession {
  id: string;
  subject: string;
  activity: Activity;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  breakMinutes: number;
  taskId: string | null;
  examinationId: string | null;
  notes: string | null;
  provenance: 'manual';
  createdAt: string;
  updatedAt: string;
}
export interface StudyQuery extends PageQuery {
  from?: string;
  to?: string;
  subject?: string;
  taskId?: string;
  examinationId?: string;
}
export interface ExamInput {
  title: string;
  subject: string;
  scheduledAt: string;
  timeZone: string;
  durationMinutes?: number | null;
  status?: 'scheduled' | 'completed' | 'canceled';
  score?: number | null;
  maxScore?: number | null;
}
export type ExamPatch = Partial<ExamInput>;
export interface Examination {
  id: string;
  title: string;
  subject: string;
  scheduledAt: string;
  timeZone: string;
  durationMinutes: number | null;
  status: 'scheduled' | 'completed' | 'canceled';
  score: number | null;
  maxScore: number | null;
  createdAt: string;
  updatedAt: string;
}
export interface ExamQuery extends PageQuery {
  from?: string;
  to?: string;
  subject?: string;
  status?: 'scheduled' | 'completed' | 'canceled';
}
export function validateStudy(
  input: StudyPatch,
  partial = false,
  now = new Date(),
) {
  fields(
    input,
    [
      'subject',
      'activity',
      'startsAt',
      'endsAt',
      'timeZone',
      'breakMinutes',
      'taskId',
      'examinationId',
      'notes',
    ],
    partial,
  );
  const result: StudyPatch = {};
  if (!partial || input.subject !== undefined)
    result.subject = text(input.subject!, 100);
  if (input.activity !== undefined)
    result.activity = choice(input.activity, [
      'reading',
      'practice',
      'review',
      'lecture',
    ]);
  if (!partial || input.startsAt !== undefined)
    result.startsAt = instant(input.startsAt!);
  if (!partial || input.endsAt !== undefined)
    result.endsAt = instant(input.endsAt!);
  if (!partial || input.timeZone !== undefined)
    result.timeZone = timeZone(input.timeZone!);
  if (input.breakMinutes !== undefined) {
    if (
      !Number.isInteger(input.breakMinutes) ||
      input.breakMinutes < 0 ||
      input.breakMinutes > 1440
    )
      throw new ApplicationError(400);
    result.breakMinutes = input.breakMinutes;
  }
  if (input.taskId !== undefined)
    result.taskId = input.taskId === null ? null : uuid(input.taskId);
  if (input.examinationId !== undefined)
    result.examinationId =
      input.examinationId === null ? null : uuid(input.examinationId);
  if (input.notes !== undefined)
    result.notes = input.notes === null ? null : text(input.notes, 1000);
  if (result.endsAt && Date.parse(result.endsAt) > now.getTime())
    throw new ApplicationError(400);
  if (result.startsAt && result.endsAt)
    observedInterval(
      result.startsAt,
      result.endsAt,
      result.breakMinutes ?? 0,
      24,
      now,
    );
  return result;
}
export function validateExam(input: ExamPatch, partial = false) {
  fields(
    input,
    [
      'title',
      'subject',
      'scheduledAt',
      'timeZone',
      'durationMinutes',
      'status',
      'score',
      'maxScore',
    ],
    partial,
  );
  const result: ExamPatch = {};
  if (!partial || input.title !== undefined)
    result.title = text(input.title!, 200);
  if (!partial || input.subject !== undefined)
    result.subject = text(input.subject!, 100);
  if (!partial || input.scheduledAt !== undefined)
    result.scheduledAt = instant(input.scheduledAt!);
  if (!partial || input.timeZone !== undefined)
    result.timeZone = timeZone(input.timeZone!);
  if (input.durationMinutes !== undefined) {
    if (
      input.durationMinutes !== null &&
      (!Number.isInteger(input.durationMinutes) ||
        input.durationMinutes < 1 ||
        input.durationMinutes > 1440)
    )
      throw new ApplicationError(400);
    result.durationMinutes = input.durationMinutes;
  }
  if (input.status !== undefined)
    result.status = choice(input.status, [
      'scheduled',
      'completed',
      'canceled',
    ]);
  if (input.score !== undefined)
    result.score = input.score === null ? null : amount(input.score);
  if (input.maxScore !== undefined)
    result.maxScore =
      input.maxScore === null ? null : amount(input.maxScore, true);
  if (!partial) {
    const score = result.score ?? null,
      max = result.maxScore ?? null;
    if (
      (score === null) !== (max === null) ||
      (score !== null &&
        (score > max! || (result.status ?? 'scheduled') !== 'completed'))
    )
      throw new ApplicationError(400);
  }
  return result;
}
export function studyMetrics(row: StudySession) {
  const elapsed = elapsedMinutes(row.startsAt, row.endsAt);
  return {
    ...row,
    durationMinutes: round(elapsed),
    focusedMinutes: round(elapsed - row.breakMinutes),
  };
}
export function examMetrics(row: Examination) {
  return {
    ...row,
    scorePercent:
      row.score === null ? null : round((row.score / row.maxScore!) * 100),
  };
}
export function educationSummary(
  rows: StudySession[],
  exams: Examination[],
  zone: string,
) {
  let total = 0;
  const days = new Map<
    string,
    { date: string; focusedMinutes: number; sessionCount: number }
  >();
  const subjects = new Map<
    string,
    { subject: string; focusedMinutes: number; sessionCount: number }
  >();
  for (const row of rows) {
    const focused = elapsedMinutes(row.startsAt, row.endsAt) - row.breakMinutes;
    total += focused;
    const key = localDate(row.endsAt, zone);
    const day = days.get(key) ?? {
      date: key,
      focusedMinutes: 0,
      sessionCount: 0,
    };
    day.focusedMinutes += focused;
    day.sessionCount++;
    days.set(key, day);
    const subject = subjects.get(row.subject) ?? {
      subject: row.subject,
      focusedMinutes: 0,
      sessionCount: 0,
    };
    subject.focusedMinutes += focused;
    subject.sessionCount++;
    subjects.set(row.subject, subject);
  }
  const graded = exams.filter(
    (row) => row.status === 'completed' && row.score !== null,
  );
  return {
    sessionCount: rows.length,
    totalFocusedMinutes: round(total),
    averageFocusedMinutes: rows.length ? round(total / rows.length) : null,
    subjects: [...subjects.values()]
      .sort((a, b) => a.subject.localeCompare(b.subject, 'en'))
      .map((row) => ({ ...row, focusedMinutes: round(row.focusedMinutes) })),
    daily: [...days.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({ ...row, focusedMinutes: round(row.focusedMinutes) })),
    examinations: {
      count: exams.length,
      completedCount: exams.filter((row) => row.status === 'completed').length,
      canceledCount: exams.filter((row) => row.status === 'canceled').length,
      gradedCount: graded.length,
      averageScorePercent: graded.length
        ? round(
            graded.reduce(
              (sum, row) => sum + (row.score! / row.maxScore!) * 100,
              0,
            ) / graded.length,
          )
        : null,
    },
  };
}
