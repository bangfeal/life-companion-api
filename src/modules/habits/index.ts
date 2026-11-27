import type { createDatabase } from '../../infrastructure/database/client.js';
import type { IdentityService } from '../identity/index.js';
import type { GoalsService } from '../goals/index.js';
import { createService } from './application/service.js';
import { createRepository } from './infrastructure/repository.js';
export type { HabitsService } from './application/service.js';
export { registerRoutes as registerHabitsRoutes } from './http/routes.js';
export function createHabitsService(
  db: ReturnType<typeof createDatabase>['db'],
  identity: Pick<IdentityService, 'authenticate'>,
  related: Pick<GoalsService, 'get'>,
) {
  return createService(createRepository(db), identity, related);
}
