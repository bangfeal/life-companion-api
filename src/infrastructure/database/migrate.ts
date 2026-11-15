import 'dotenv/config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { readDatabaseUrl } from '../../config.js';
import { createDatabase } from './client.js';
const database = createDatabase(readDatabaseUrl());
try {
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(
      new URL('../../../drizzle/migrations', import.meta.url),
    ),
  });
  console.log('Migrations applied.');
} catch {
  console.error(
    'Migration failed. Check database availability and migration files.',
  );
  process.exitCode = 1;
} finally {
  await database.close();
}
