// Migration discovery only; other modules must use identity's public services.
export {
  users,
  userProfiles,
  authSessions,
} from '../../modules/identity/infrastructure/tables.js';

// Schema discovery is the sole exception to module-private table imports.
export {
  goals,
  goalDomains,
} from '../../modules/goals/infrastructure/tables.js';
export {
  table as habits,
  habitLogs,
} from '../../modules/habits/infrastructure/tables.js';
export { table as tasks } from '../../modules/tasks/infrastructure/tables.js';
export { table as scheduleEvents } from '../../modules/scheduling/infrastructure/tables.js';
