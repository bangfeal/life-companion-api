import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { createDatabase } from '../../src/infrastructure/database/client.js';
import { createIdentityService } from '../../src/modules/identity/index.js';

type App = Awaited<ReturnType<typeof buildApp>>;
const password = 'correct horse battery staple';
const suffix = randomUUID();
const email = (name: string) => `${name}-${suffix}@example.test`;
let database: ReturnType<typeof createDatabase>;
let app: App;
let service: ReturnType<typeof createIdentityService>;
let alice: {
  accessToken: string;
  user: {
    id: string;
    email: string;
    profile: { displayName: string | null; timeZone: string };
  };
};
let bob: typeof alice;
const headers = (token: string) => ({ authorization: `Bearer ${token}` });
const apps: App[] = [];
const createdUserIds: string[] = [];

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    throw new Error(
      'Set TEST_DATABASE_URL to a disposable PostgreSQL database',
    );
  database = createDatabase(url);
  await migrate(database.db, { migrationsFolder: 'drizzle/migrations' });
  service = createIdentityService(database.db);
  app = await buildApp({}, service);
  apps.push(app);
  for (const name of ['alice', 'bob']) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: email(name), password },
    });
    expect(response.statusCode).toBe(201);
    const result = response.json();
    createdUserIds.push(result.user.id);
    if (name === 'alice') alice = result;
    else bob = result;
  }
}, 20000);
afterAll(async () => {
  await Promise.all(apps.map((instance) => instance.close()));
  if (database) {
    // Only remove accounts created by this suite; FK cascades clean profiles/sessions.
    for (const id of createdUserIds)
      await database.db.execute(sql`delete from users where id = ${id}::uuid`);
    await database.close();
  }
});

describe('identity HTTP → application → PostgreSQL', () => {
  it('returns public DTOs and stores only password/token hashes', async () => {
    const response = await app.inject({
      url: '/api/v1/me',
      headers: headers(alice.accessToken),
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({
      id: alice.user.id,
      email: email('alice'),
      profile: { displayName: null, timeZone: 'UTC' },
    });
    expect(response.body).not.toMatch(/password|tokenHash|accessToken/);
    const rows = await database.db.execute(
      sql`select password_hash from users where id = ${alice.user.id}::uuid`,
    );
    expect(rows[0]?.password_hash).toMatch(/^scrypt-v1\$/);
    const otherHashes = await database.db.execute(
      sql`select password_hash from users where id = ${bob.user.id}::uuid`,
    );
    expect(otherHashes[0]?.password_hash).not.toBe(rows[0]?.password_hash);
    const sessions = await database.db.execute(
      sql`select token_hash from auth_sessions where user_id = ${alice.user.id}::uuid`,
    );
    expect(sessions[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sessions[0]?.token_hash).not.toBe(alice.accessToken);
  });
  it('isolates private reads and profile writes using server-resolved session ownership', async () => {
    const changed = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: headers(alice.accessToken),
      payload: { displayName: ' Alice ', timeZone: 'Europe/Madrid' },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().profile).toEqual({
      displayName: 'Alice',
      timeZone: 'Europe/Madrid',
    });
    const other = await app.inject({
      url: '/api/v1/me',
      headers: headers(bob.accessToken),
    });
    expect(other.json()).toMatchObject({
      id: bob.user.id,
      profile: { displayName: null, timeZone: 'UTC' },
    });
    expect(other.body).not.toContain(alice.user.id);
    const attack = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: headers(alice.accessToken),
      payload: { userId: bob.user.id, displayName: 'Stolen' },
    });
    expect(attack.statusCode).toBe(400);
    const impersonation = await app.inject({
      url: `/api/v1/me?userId=${bob.user.id}`,
      headers: headers(alice.accessToken),
    });
    expect(impersonation.statusCode).toBe(400);
    // The application operation rejects identity overrides even without an HTTP handler.
    await expect(
      service.updateProfile(alice.accessToken, {
        displayName: 'Stolen',
        userId: bob.user.id,
      } as { displayName: string }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect((await service.me(bob.accessToken)).profile.displayName).toBeNull();
    expect((await service.me(alice.accessToken)).profile.displayName).toBe(
      'Alice',
    );
  });
  it('enforces authentication inside application operations as well as HTTP', async () => {
    for (const authorization of [
      '',
      'Basic anything',
      `Bearer ${'x'.repeat(43)}`,
      `Bearer ${alice.user.id}`,
    ]) {
      const response = await app.inject({
        url: '/api/v1/me',
        headers: { authorization },
      });
      expect(response.statusCode).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer');
      expect(response.headers['content-type']).toContain(
        'application/problem+json',
      );
    }
    await expect(service.me(undefined)).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(
      service.updateProfile('x'.repeat(43), { displayName: 'Attacker' }),
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(service.logout(undefined)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
  it('supports partial updates and rejects invalid profiles', async () => {
    for (const payload of [
      {},
      { timeZone: 'Not/AZone' },
      { timeZone: '+02:00' },
      { displayName: '  ' },
      { email: email('bob') },
    ]) {
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: '/api/v1/me',
            headers: headers(alice.accessToken),
            payload,
          })
        ).statusCode,
      ).toBe(400);
    }
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: headers(alice.accessToken),
      payload: { displayName: null },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().profile).toEqual({
      displayName: null,
      timeZone: 'Europe/Madrid',
    });
  });
  it('uses case-insensitive credentials and identical errors for invalid login', async () => {
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: email('absent'), password },
    });
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: email('alice'),
        password: 'a different invalid password',
      },
    });
    expect(unknown.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
    expect(unknown.json()).toEqual(wrong.json());
    const valid = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: email('alice').toUpperCase(), password },
    });
    expect(valid.statusCode).toBe(200);
    expect(valid.json().user.id).toBe(alice.user.id);
    expect(valid.json().accessToken).not.toBe(alice.accessToken);
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: email('alice').toUpperCase(), password },
    });
    expect(duplicate.statusCode).toBe(409);
  }, 15000);
  it('rejects expired sessions for reads and writes at the application boundary', async () => {
    const expired = createIdentityService(
      database.db,
      () => new Date(Date.now() + 8 * 86400000),
    );
    await expect(expired.me(alice.accessToken)).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(
      expired.updateProfile(bob.accessToken, { displayName: 'Expired' }),
    ).rejects.toMatchObject({ statusCode: 401 });
    const expiredApp = await buildApp({}, expired);
    apps.push(expiredApp);
    expect(
      (
        await expiredApp.inject({
          url: '/api/v1/me',
          headers: headers(alice.accessToken),
        })
      ).statusCode,
    ).toBe(401);
    expect((await service.me(bob.accessToken)).profile.displayName).toBeNull();
  });
  it('revokes only the presented session and makes retries harmless', async () => {
    const login = await service.login({ email: email('alice'), password });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: headers(alice.accessToken),
    });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(
      (
        await app.inject({
          url: '/api/v1/me',
          headers: headers(alice.accessToken),
        })
      ).statusCode,
    ).toBe(401);
    await expect(
      service.updateProfile(alice.accessToken, { displayName: 'Revoked' }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect((await service.me(login.accessToken)).id).toBe(alice.user.id);
    expect((await service.me(bob.accessToken)).id).toBe(bob.user.id);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/auth/logout',
          headers: headers(alice.accessToken),
        })
      ).statusCode,
    ).toBe(401);
  });
  it('handles concurrent duplicate registration with one account and profile', async () => {
    const results = await Promise.all(
      [
        service.register({ email: email('race'), password }),
        service.register({ email: email('race'), password }),
      ].map((promise) =>
        promise.then(
          (value) => {
            createdUserIds.push(value.user.id);
            return 201;
          },
          (error) => error.statusCode,
        ),
      ),
    );
    expect(results.sort()).toEqual([201, 409]);
    const rows = await database.db.execute(
      sql`select count(*)::int as count from users join user_profiles on users.id = user_profiles.user_id where users.email = ${email('race')}`,
    );
    expect(rows[0]?.count).toBe(1);
  }, 15000);
  it('rate-limits registration and login before expensive work and returns Problem Details', async () => {
    const limited = await buildApp({}, service);
    apps.push(limited);
    for (let i = 0; i < 10; i++) {
      const response = await limited.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'bad', password: 'short' },
      });
      expect(response.statusCode).toBe(400);
    }
    const response = await limited.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'bad', password: 'short' },
    });
    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBeDefined();
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
