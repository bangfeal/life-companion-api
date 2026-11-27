import type { createDatabase } from '../../infrastructure/database/client.js';
import type { IdentityService } from '../identity/index.js';
import { createService } from './application/service.js';
import { createRepository } from './infrastructure/repository.js';
export type { SleepService } from './application/service.js';
export { registerRoutes as registerSleepRoutes } from './http/routes.js';
export function createSleepService(
  db: ReturnType<typeof createDatabase>['db'],
  identity: Pick<IdentityService, 'authenticate'>,
) {
  return createService(createRepository(db), identity);
}

export { SleepSummarySchema } from './http/contracts.js';
