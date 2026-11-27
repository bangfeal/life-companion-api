import type { createDatabase } from '../../infrastructure/database/client.js';
import type { IdentityService } from '../identity/index.js';
import { createGoalsService as createService } from './application/service.js';
import { goalsRepository } from './infrastructure/repository.js';
export type { GoalsService } from './application/service.js';
export { registerRoutes as registerGoalsRoutes } from './http/routes.js';
export function createGoalsService(
  db: ReturnType<typeof createDatabase>['db'],
  identity: Pick<IdentityService, 'authenticate'>,
) {
  return createService(goalsRepository(db), identity);
}
