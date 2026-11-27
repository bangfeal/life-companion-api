// Composition root: modules consume only each other's published services.
import type { createDatabase } from './infrastructure/database/client.js';
import type { IdentityService } from './modules/identity/index.js';
import { createGoalsService } from './modules/goals/index.js';
import { createHabitsService } from './modules/habits/index.js';
import { createTasksService } from './modules/tasks/index.js';
import { createSleepService } from './modules/sleep/index.js';
import { createEducationService } from './modules/education/index.js';
import { createReviewService } from './modules/analytics/index.js';
import { createSchedulingService } from './modules/scheduling/index.js';
export function createLifeManagement(
  db: ReturnType<typeof createDatabase>['db'],
  identity: IdentityService,
) {
  const goals = createGoalsService(db, identity);
  const habits = createHabitsService(db, identity, goals);
  const tasks = createTasksService(db, identity, goals);
  const scheduling = createSchedulingService(db, identity, tasks);
  const sleep = createSleepService(db, identity);
  const education = createEducationService(db, identity, tasks, scheduling);
  const analytics = createReviewService(identity, sleep, education);
  return { goals, habits, tasks, scheduling, sleep, education, analytics };
}
export type LifeManagementServices = ReturnType<typeof createLifeManagement>;
