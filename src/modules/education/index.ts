import type { createDatabase } from '../../infrastructure/database/client.js';
import type { IdentityService } from '../identity/index.js';
import type { TasksService } from '../tasks/index.js';
import type { SchedulingService } from '../scheduling/index.js';
import { createService } from './application/service.js';
import { createRepository } from './infrastructure/repository.js';
export type { EducationService } from './application/service.js';
export { registerRoutes as registerEducationRoutes } from './http/routes.js';
export function createEducationService(
  db: ReturnType<typeof createDatabase>['db'],
  identity: Pick<IdentityService, 'authenticate'>,
  tasks: Pick<TasksService, 'get'>,
  scheduling: Pick<SchedulingService, 'create'>,
) {
  return createService(createRepository(db), identity, tasks, scheduling);
}

export { EducationSummarySchema } from './http/contracts.js';
