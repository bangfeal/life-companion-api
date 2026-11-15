import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
export function createDatabase(url: string) {
  const client = postgres(url, {
    max: 5,
    connect_timeout: 5,
    onnotice: () => {},
  });
  return { db: drizzle(client), close: () => client.end({ timeout: 5 }) };
}
