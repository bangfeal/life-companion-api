// Migration discovery only; other modules must use identity's public services.
export {
  users,
  userProfiles,
  authSessions,
} from '../../modules/identity/infrastructure/tables.js';
