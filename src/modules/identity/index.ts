import { createIdentityService as createService } from './application/service.js';
import {
  identityRepository,
  type Database,
} from './infrastructure/repository.js';
export type { IdentityService } from './application/service.js';
export { registerIdentityRoutes } from './http/routes.js';
export function createIdentityService(db: Database, now?: () => Date) {
  return createService(identityRepository(db), now);
}
