import { expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from '../../src/infrastructure/database/client.js';
// Explicit opt-in: use a disposable database; this test applies migrations.
it('applies migrations to PostgreSQL and safely reruns them', async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    throw new Error(
      'Set TEST_DATABASE_URL to a disposable PostgreSQL database',
    );
  const database = createDatabase(url);
  try {
    await migrate(database.db, { migrationsFolder: 'drizzle/migrations' });
    await migrate(database.db, { migrationsFolder: 'drizzle/migrations' });
    const rows = await database.db.execute(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    expect(rows[0]?.count).toBe(
      readMigrationFiles({ migrationsFolder: 'drizzle/migrations' }).length,
    );
    const result = await database.db.execute(sql`select 1 as value`);
    expect(result[0]?.value).toBe(1);
  } finally {
    await database.close();
  }
}, 30000);
