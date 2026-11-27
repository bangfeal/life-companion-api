import type { createDatabase } from '../../infrastructure/database/client.js';
import type { IdentityService } from '../identity/index.js';
import type { TasksService } from '../tasks/index.js';
import { createService } from './application/service.js';
import { createRepository } from './infrastructure/repository.js';
export type { SchedulingService } from './application/service.js';
export { registerRoutes as registerSchedulingRoutes } from './http/routes.js';
export function createSchedulingService(
  db: ReturnType<typeof createDatabase>['db'],
  identity: Pick<IdentityService, 'authenticate'>,
  related: Pick<TasksService, 'get'>,
) {
  return createService(createRepository(db), identity, related);
}
