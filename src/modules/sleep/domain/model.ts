import {
  ApplicationError,
  choice,
  fields,
  instant,
  text,
  timeZone,
  type PageQuery,
} from '../../../shared/domain/validation.js';
import {
  elapsedMinutes,
  localDate,
  localMinute,
  observedInterval,
  round,
} from '../../../shared/domain/time.js';
export interface SleepInput {
  startsAt: string;
  endsAt: string;
  timeZone: string;
  awakeMinutes?: number;
  kind?: 'main' | 'nap';
  quality?: number | null;
  notes?: string | null;
}
export type SleepPatch = Partial<SleepInput>;
export interface SleepSession {
  id: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  awakeMinutes: number;
  kind: 'main' | 'nap';
  quality: number | null;
  notes: string | null;
  provenance: 'manual';
  createdAt: string;
  updatedAt: string;
}
export interface SleepQuery extends PageQuery {
  from?: string;
  to?: string;
  kind?: 'main' | 'nap';
}
export function validateSleep(
  input: SleepPatch,
  partial = false,
  now = new Date(),
) {
  fields(
    input,
    [
      'startsAt',
      'endsAt',
      'timeZone',
      'awakeMinutes',
      'kind',
      'quality',
      'notes',
    ],
    partial,
  );
  const result: SleepPatch = {};
  if (!partial || input.startsAt !== undefined)
    result.startsAt = instant(input.startsAt!);
  if (!partial || input.endsAt !== undefined)
    result.endsAt = instant(input.endsAt!);
  if (!partial || input.timeZone !== undefined)
    result.timeZone = timeZone(input.timeZone!);
  if (input.awakeMinutes !== undefined) {
    if (
      !Number.isInteger(input.awakeMinutes) ||
      input.awakeMinutes < 0 ||
      input.awakeMinutes > 2880
    )
      throw new ApplicationError(400);
    result.awakeMinutes = input.awakeMinutes;
  }
  if (input.kind !== undefined)
    result.kind = choice(input.kind, ['main', 'nap']);
  if (input.quality !== undefined) {
    if (
      input.quality !== null &&
      (!Number.isInteger(input.quality) ||
        input.quality < 1 ||
        input.quality > 5)
    )
      throw new ApplicationError(400);
    result.quality = input.quality;
  }
  if (input.notes !== undefined)
    result.notes = input.notes === null ? null : text(input.notes, 1000);
  if (result.endsAt && Date.parse(result.endsAt) > now.getTime())
    throw new ApplicationError(400);
  if (result.startsAt && result.endsAt)
    observedInterval(
      result.startsAt,
      result.endsAt,
      result.awakeMinutes ?? 0,
      48,
      now,
    );
  return result;
}
export function sleepMetrics(row: SleepSession) {
  const elapsed = elapsedMinutes(row.startsAt, row.endsAt);
  return {
    ...row,
    durationMinutes: round(elapsed),
    sleepMinutes: round(elapsed - row.awakeMinutes),
  };
}
export function sleepSummary(rows: SleepSession[], zone: string) {
  const total = rows.reduce(
    (sum, row) =>
      sum + elapsedMinutes(row.startsAt, row.endsAt) - row.awakeMinutes,
    0,
  );
  const main = rows
    .filter((row) => row.kind === 'main')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const shifts = main.slice(1).map((row, i) => {
    const delta = Math.abs(
      localMinute(row.startsAt, zone) - localMinute(main[i]!.startsAt, zone),
    );
    return Math.min(delta, 1440 - delta);
  });
  const days = new Map<
    string,
    { date: string; sleepMinutes: number; sessionCount: number }
  >();
  for (const row of rows) {
    const day = localDate(row.endsAt, zone);
    const item = days.get(day) ?? {
      date: day,
      sleepMinutes: 0,
      sessionCount: 0,
    };
    item.sleepMinutes +=
      elapsedMinutes(row.startsAt, row.endsAt) - row.awakeMinutes;
    item.sessionCount++;
    days.set(day, item);
  }
  return {
    sessionCount: rows.length,
    mainSessionCount: main.length,
    napCount: rows.length - main.length,
    totalSleepMinutes: round(total),
    averageSleepMinutes: rows.length ? round(total / rows.length) : null,
    bedtimeConsistency: {
      sampleCount: main.length,
      comparisonCount: shifts.length,
      meanAbsoluteShiftMinutes: shifts.length
        ? round(shifts.reduce((a, b) => a + b, 0) / shifts.length)
        : null,
    },
    daily: [...days.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({ ...day, sleepMinutes: round(day.sleepMinutes) })),
  };
}
