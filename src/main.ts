import 'dotenv/config';
import { buildApp } from './app.js';
import { createDatabase } from './infrastructure/database/client.js';
import { createIdentityService } from './modules/identity/index.js';
import { readDatabaseUrl, readConfig } from './config.js';

const config = readConfig();
const database = createDatabase(readDatabaseUrl());
const app = await buildApp(
  {
    logger: {
      level: config.logLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'password',
          'token',
          'accessToken',
          'passwordHash',
          'databaseUrl',
        ],
        censor: '[REDACTED]',
      },
    },
  },
  createIdentityService(database.db),
);
app.addHook('onClose', async () => {
  await database.close();
});
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  try {
    await app.close();
  } catch {
    process.exitCode = 1;
  }
}
process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
try {
  await app.listen({ host: config.host, port: config.port });
} catch {
  app.log.fatal('Server failed to start');
  await app.close();
  process.exitCode = 1;
}
