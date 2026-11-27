import type { IdentityService } from '../../identity/index.js';
import type { SleepService } from '../../sleep/index.js';
import type { EducationService } from '../../education/index.js';
import { windowQuery, type WindowQuery } from '../../../shared/domain/time.js';
export function createReviewService(
  identity: Pick<IdentityService, 'authenticate'>,
  sleep: Pick<SleepService, 'summary'>,
  education: Pick<EducationService, 'summary'>,
) {
  return {
    async sleepStudy(token: string | undefined, query: WindowQuery) {
      await identity.authenticate(token);
      const window = windowQuery(query);
      const [sleepSummary, educationSummary] = await Promise.all([
        sleep.summary(token, window),
        education.summary(token, window),
      ]);
      const days = new Map<
        string,
        {
          date: string;
          sleepMinutes: number | null;
          studyMinutes: number | null;
          sleepSessionCount: number;
          studySessionCount: number;
        }
      >();
      for (const row of sleepSummary.daily)
        days.set(row.date, {
          date: row.date,
          sleepMinutes: row.sleepMinutes,
          studyMinutes: null,
          sleepSessionCount: row.sessionCount,
          studySessionCount: 0,
        });
      for (const row of educationSummary.daily) {
        const day = days.get(row.date) ?? {
          date: row.date,
          sleepMinutes: null,
          studyMinutes: null,
          sleepSessionCount: 0,
          studySessionCount: 0,
        };
        day.studyMinutes = row.focusedMinutes;
        day.studySessionCount = row.sessionCount;
        days.set(row.date, day);
      }
      return {
        ...window,
        sleep: sleepSummary,
        education: educationSummary,
        daily: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
        interpretation:
          'Descriptive totals only. No causal relationship or health recommendation is inferred.',
      };
    },
  };
}
export type ReviewService = ReturnType<typeof createReviewService>;
