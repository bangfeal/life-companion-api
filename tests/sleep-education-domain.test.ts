import { describe, expect, it } from 'vitest';
import {
  validateSleep,
  sleepMetrics,
  sleepSummary,
  type SleepSession,
} from '../src/modules/sleep/domain/model.js';
import {
  validateStudy,
  validateExam,
  studyMetrics,
  educationSummary,
  type StudySession,
  type Examination,
} from '../src/modules/education/domain/model.js';
import {
  boundedSummary,
  windowQuery,
  localDate,
} from '../src/shared/domain/time.js';
const now = new Date('2026-11-27T12:00:00Z');
function sleep(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    id: 'sleep',
    startsAt: '2026-10-24T22:00:00Z',
    endsAt: '2026-10-25T07:00:00Z',
    timeZone: 'Europe/Madrid',
    awakeMinutes: 30,
    kind: 'main',
    quality: null,
    notes: null,
    provenance: 'manual',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}
function study(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: 'study',
    subject: 'Mathematics',
    activity: 'practice',
    startsAt: '2026-10-25T09:00:00Z',
    endsAt: '2026-10-25T10:30:00Z',
    timeZone: 'Europe/Madrid',
    breakMinutes: 15,
    taskId: null,
    examinationId: null,
    notes: null,
    provenance: 'manual',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}
function exam(overrides: Partial<Examination> = {}): Examination {
  return {
    id: 'exam',
    title: 'Algebra',
    subject: 'Mathematics',
    scheduledAt: '2026-10-25T12:00:00Z',
    timeZone: 'UTC',
    durationMinutes: 60,
    status: 'completed',
    score: 15,
    maxScore: 20,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe('sleep and education calculations without HTTP or PostgreSQL', () => {
  it('uses actual elapsed time across DST and subtracts reported awake time', () => {
    const row = sleep({
      startsAt: '2026-10-25T02:30:00+02:00',
      endsAt: '2026-10-25T02:15:00+01:00',
      awakeMinutes: 5,
    });
    const valid = validateSleep(
      {
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        timeZone: row.timeZone,
        awakeMinutes: 5,
      },
      false,
      now,
    );
    expect(valid.startsAt).toBe('2026-10-25T00:30:00.000Z');
    expect(sleepMetrics(row).durationMinutes).toBe(45);
    expect(sleepMetrics(row).sleepMinutes).toBe(40);
  });
  it('rejects invalid, future, excessively long, or fully awake sleep intervals', () => {
    const base = {
      startsAt: '2026-10-25T00:00:00Z',
      endsAt: '2026-10-25T01:00:00Z',
      timeZone: 'UTC',
    };
    for (const patch of [
      { endsAt: base.startsAt },
      { awakeMinutes: 60 },
      { awakeMinutes: -1 },
      { awakeMinutes: 1.5 },
      { quality: 6 },
      { endsAt: '2027-01-01T00:00:00Z' },
      { endsAt: '2026-10-28T00:00:00Z' },
      { timeZone: 'Invalid/Zone' },
    ])
      expect(() => validateSleep({ ...base, ...patch }, false, now)).toThrow();
  });
  it('measures bedtime shifts circularly across midnight and excludes naps', () => {
    const rows = [
      sleep({
        startsAt: '2026-10-24T23:30:00Z',
        endsAt: '2026-10-25T07:00:00Z',
      }),
      sleep({
        id: 'next',
        startsAt: '2026-10-26T00:30:00Z',
        endsAt: '2026-10-26T08:00:00Z',
      }),
      sleep({
        id: 'nap',
        kind: 'nap',
        startsAt: '2026-10-25T13:00:00Z',
        endsAt: '2026-10-25T14:00:00Z',
        awakeMinutes: 0,
      }),
    ];
    const summary = sleepSummary(rows, 'UTC');
    expect(summary.bedtimeConsistency).toEqual({
      sampleCount: 2,
      comparisonCount: 1,
      meanAbsoluteShiftMinutes: 60,
    });
    expect(summary.napCount).toBe(1);
    expect(summary.daily).toHaveLength(2);
  });
  it('uses requested timezone for day assignment and retains absence as unknown averages', () => {
    expect(localDate('2026-10-25T00:30:00Z', 'America/New_York')).toBe(
      '2026-10-24',
    );
    expect(sleepSummary([], 'UTC')).toMatchObject({
      sessionCount: 0,
      totalSleepMinutes: 0,
      averageSleepMinutes: null,
      bedtimeConsistency: { meanAbsoluteShiftMinutes: null },
    });
    expect(educationSummary([], [], 'UTC')).toMatchObject({
      sessionCount: 0,
      averageFocusedMinutes: null,
      examinations: { averageScorePercent: null },
    });
  });
  it('calculates focused time, subject totals, and unweighted exam percentages', () => {
    expect(studyMetrics(study()).focusedMinutes).toBe(75);
    const summary = educationSummary(
      [
        study(),
        study({
          subject: 'History',
          startsAt: '2026-10-25T11:00:00Z',
          endsAt: '2026-10-25T12:00:00Z',
          breakMinutes: 0,
        }),
      ],
      [exam(), exam({ score: 4, maxScore: 10 })],
      'UTC',
    );
    expect(summary.totalFocusedMinutes).toBe(135);
    expect(summary.subjects).toHaveLength(2);
    expect(summary.examinations.averageScorePercent).toBe(57.5);
  });
  it('rejects impossible study sessions and invalid exam result combinations', () => {
    expect(() =>
      validateStudy(
        {
          subject: 'Math',
          startsAt: '2026-10-25T09:00:00Z',
          endsAt: '2026-10-25T10:00:00Z',
          timeZone: 'UTC',
          breakMinutes: 60,
        },
        false,
        now,
      ),
    ).toThrow();
    const base = {
      title: 'Exam',
      subject: 'Math',
      scheduledAt: '2027-01-01T10:00:00Z',
      timeZone: 'UTC',
    };
    for (const patch of [
      { score: 3 },
      { maxScore: 10 },
      { score: 11, maxScore: 10, status: 'completed' as const },
      { score: 5, maxScore: 10 },
      { durationMinutes: 0 },
    ])
      expect(() => validateExam({ ...base, ...patch })).toThrow();
    expect(
      validateExam({ ...base, status: 'completed', score: 0, maxScore: 20 })
        .score,
    ).toBe(0);
  });
  it('rejects empty/unknown patches and caps summary intervals and source counts', () => {
    for (const validate of [validateSleep, validateStudy, validateExam]) {
      expect(() => validate({}, true)).toThrow();
      expect(() => validate({ userId: 'other' } as never, true)).toThrow();
    }
    expect(
      windowQuery({ from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z' })
        .timeZone,
    ).toBe('UTC');
    expect(() =>
      windowQuery({ from: '2026-01-01T00:00:00Z', to: '2026-12-01T00:00:00Z' }),
    ).toThrow();
    expect(() =>
      windowQuery({ from: '2026-10-01T00:00:00Z', to: '2026-10-01T00:00:00Z' }),
    ).toThrow();
    expect(() => boundedSummary(new Array(10001).fill(1))).toThrow();
  });
});
