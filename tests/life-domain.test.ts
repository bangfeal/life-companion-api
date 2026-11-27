import { describe, expect, it } from 'vitest';
import {
  goalProgress,
  validateGoal,
} from '../src/modules/goals/domain/model.js';
import { validateHabit } from '../src/modules/habits/domain/model.js';
import { validateTask } from '../src/modules/tasks/domain/model.js';
import { validateEvent } from '../src/modules/scheduling/domain/model.js';
import {
  date,
  instant,
  pagination,
  page,
} from '../src/shared/domain/validation.js';

describe('life-management domain rules without HTTP or PostgreSQL', () => {
  it('calculates bounded measurable progress and validates targets', () => {
    expect(goalProgress(3, 8)).toBe(37.5);
    expect(goalProgress(12, 8)).toBe(100);
    expect(goalProgress(0, 8)).toBe(0);
    for (const targetValue of [0, -1, Infinity, NaN, 1e13])
      expect(() =>
        validateGoal({ title: 'Study', targetValue, unit: 'hours' }),
      ).toThrow();
    expect(() =>
      validateGoal({
        title: 'Study',
        targetValue: 10,
        unit: 'hours',
        domains: ['sleep', 'sleep'],
      }),
    ).toThrow();
    expect(() =>
      validateGoal({
        title: 'Study',
        targetValue: 10,
        unit: 'hours',
        domains: ['invented'] as never,
      }),
    ).toThrow();
  });
  it('distinguishes calendar dates from offset-bearing instants', () => {
    expect(date('2028-02-29')).toBe('2028-02-29');
    for (const input of [
      '2026-02-29',
      '2026-04-31',
      '0000-01-01',
      '2026-01-01T00:00:00Z',
    ])
      expect(() => date(input)).toThrow();
    expect(instant('2026-10-25T02:30:00+02:00')).toBe(
      '2026-10-25T00:30:00.000Z',
    );
    for (const input of [
      '2026-10-25T02:30:00',
      '2026-02-30T00:00:00Z',
      '2026-10-25T24:00:00Z',
    ])
      expect(() => instant(input)).toThrow();
  });
  it('validates event intervals by instant across DST changes', () => {
    const result = validateEvent({
      title: 'Review',
      startsAt: '2026-10-25T02:30:00+02:00',
      endsAt: '2026-10-25T02:15:00+01:00',
      timeZone: 'Europe/Madrid',
    });
    expect(Date.parse(result.endsAt!) - Date.parse(result.startsAt!)).toBe(
      45 * 60000,
    );
    expect(() =>
      validateEvent({
        title: 'Bad',
        startsAt: '2026-01-01T10:00:00Z',
        endsAt: '2026-01-01T10:00:00Z',
        timeZone: 'UTC',
      }),
    ).toThrow();
  });
  it('rejects empty patches, unknown ownership, and mutable habit timezones', () => {
    for (const validate of [
      validateGoal,
      validateHabit,
      validateTask,
      validateEvent,
    ]) {
      expect(() => validate({}, true)).toThrow();
      expect(() =>
        validate({ userId: 'someone-else' } as never, true),
      ).toThrow();
    }
    expect(() => validateHabit({ timeZone: 'Europe/Madrid' }, true)).toThrow();
    expect(() => validateTask({ dueAt: 'not an instant' })).toThrow();
  });
  it('bounds pagination and reports an explicit next offset', () => {
    expect(pagination({})).toEqual({ limit: 20, offset: 0 });
    for (const query of [
      { limit: 101 },
      { offset: -1 },
      { limit: 1.5 },
      { offset: 10001 },
    ])
      expect(() => pagination(query)).toThrow();
    expect(page([1, 2], 1, 0)).toEqual({
      items: [1],
      limit: 1,
      offset: 0,
      nextOffset: 1,
    });
    expect(page([1], 1, 0).nextOffset).toBeNull();
  });
});
