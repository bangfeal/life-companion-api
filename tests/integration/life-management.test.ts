import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { createTasksService } from '../../src/modules/tasks/index.js';
import { createLifeManagement } from '../../src/life-management.js';
import { createDatabase } from '../../src/infrastructure/database/client.js';
import { createIdentityService } from '../../src/modules/identity/index.js';
import type { HTTPMethods } from 'fastify';
let db: ReturnType<typeof createDatabase>;
let identity: ReturnType<typeof createIdentityService>;
let life: ReturnType<typeof createLifeManagement>;
let app: Awaited<ReturnType<typeof buildApp>>;
let alice: { accessToken: string; user: { id: string } };
let bob: typeof alice;
const users: string[] = [];
async function request(
  method: HTTPMethods,
  url: string,
  payload?: object,
  token = alice.accessToken,
) {
  return app.inject({
    method,
    url,
    ...(payload ? { payload } : {}),
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}
async function create(
  path: string,
  payload: object,
  token = alice.accessToken,
) {
  const response = await request('POST', path, payload, token);
  expect(response.statusCode, response.body).toBe(201);
  return response.json();
}
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL)
    throw new Error('Set TEST_DATABASE_URL to a disposable database');
  db = createDatabase(process.env.TEST_DATABASE_URL);
  await migrate(db.db, { migrationsFolder: 'drizzle/migrations' });
  identity = createIdentityService(db.db);
  life = createLifeManagement(db.db, identity);
  app = await buildApp({}, identity, life);
  for (const name of ['alice', 'bob']) {
    const result = await identity.register({
      email: `${name}-life-${randomUUID()}@example.test`,
      password: 'a long integration password',
    });
    users.push(result.user.id);
    if (name === 'alice') alice = result;
    else bob = result;
  }
}, 20000);
afterAll(async () => {
  await app?.close();
  if (db) {
    for (const id of users)
      await db.db.execute(sql`delete from users where id=${id}::uuid`);
    await db.close();
  }
});

describe('M3 authorized HTTP → application → persistence', () => {
  it('creates, reads, patches, and deletes measurable goals with domain associations', async () => {
    const goal = await create('/api/v1/goals', {
      title: ' Study consistently ',
      targetValue: 10,
      currentValue: 3,
      unit: 'hours',
      domains: ['education', 'sleep'],
      dueDate: '2027-01-31',
    });
    expect(goal.title).toBe('Study consistently');
    expect(goal.progressPercent).toBe(30);
    expect(goal.domains).toEqual(['education', 'sleep']);
    expect(goal.userId).toBeUndefined();
    const update = await request('PATCH', `/api/v1/goals/${goal.id}`, {
      currentValue: 12,
      domains: ['education'],
      description: 'Coursework',
      status: 'completed',
    });
    expect(update.statusCode, update.body).toBe(200);
    expect(update.json().progressPercent).toBe(100);
    expect(update.json().targetValue).toBe(10);
    expect(update.json().domains).toEqual(['education']);
    const read = await request('GET', `/api/v1/goals/${goal.id}`);
    expect(read.json()).toEqual(update.json());
    expect(
      (await request('DELETE', `/api/v1/goals/${goal.id}`)).statusCode,
    ).toBe(204);
    expect((await request('GET', `/api/v1/goals/${goal.id}`)).statusCode).toBe(
      404,
    );
  });
  it('paginates deterministically, scopes collections, and filters goal domains/status', async () => {
    const a = await create('/api/v1/goals', {
      title: 'A',
      targetValue: 5,
      unit: 'sessions',
      domains: ['education'],
    });
    const b = await create('/api/v1/goals', {
      title: 'B',
      targetValue: 5,
      unit: 'sessions',
      domains: ['education'],
    });
    await create(
      '/api/v1/goals',
      {
        title: 'Other user',
        targetValue: 5,
        unit: 'sessions',
        domains: ['education'],
      },
      bob.accessToken,
    );
    const first = await request(
      'GET',
      '/api/v1/goals?domain=education&status=active&limit=1',
    );
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json().items).toHaveLength(1);
    expect(first.json().nextOffset).toBe(1);
    const second = await request(
      'GET',
      '/api/v1/goals?domain=education&status=active&limit=1&offset=1',
    );
    expect(second.json().items).toHaveLength(1);
    expect(second.json().nextOffset).toBeNull();
    expect(
      new Set([first.json().items[0].id, second.json().items[0].id]),
    ).toEqual(new Set([a.id, b.id]));
    for (const query of [
      'limit=101',
      'offset=-1',
      'domain=invented',
      'userId=' + bob.user.id,
    ])
      expect((await request('GET', '/api/v1/goals?' + query)).statusCode).toBe(
        400,
      );
  });
  it('records retry-safe daily habit logs and keeps historical timezone semantics', async () => {
    const habit = await create('/api/v1/habits', {
      title: 'Read',
      timeZone: 'Europe/Madrid',
    });
    const log = { date: '2026-10-25', completed: true };
    for (let i = 0; i < 2; i++)
      expect(
        (await request('POST', `/api/v1/habits/${habit.id}/logs`, log))
          .statusCode,
      ).toBe(200);
    let logs = await request(
      'GET',
      `/api/v1/habits/${habit.id}/logs?fromDate=2026-10-25&toDate=2026-10-25`,
    );
    expect(logs.json().items).toHaveLength(1);
    expect(logs.json().items[0].completed).toBe(true);
    await request('POST', `/api/v1/habits/${habit.id}/logs`, {
      ...log,
      completed: false,
    });
    logs = await request('GET', `/api/v1/habits/${habit.id}/logs`);
    expect(logs.json().items[0].completed).toBe(false);
    expect(
      (
        await request('POST', `/api/v1/habits/${habit.id}/logs`, {
          date: '2026-02-30',
          completed: true,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request('PATCH', `/api/v1/habits/${habit.id}`, {
          timeZone: 'UTC',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await request('PATCH', `/api/v1/habits/${habit.id}`, { archived: true }))
        .statusCode,
    ).toBe(200);
    expect(
      (await request('POST', `/api/v1/habits/${habit.id}/logs`, log))
        .statusCode,
    ).toBe(409);
    expect(
      (await request('GET', '/api/v1/habits?archived=true'))
        .json()
        .items.some((item: { id: string }) => item.id === habit.id),
    ).toBe(true);
  });
  it('links tasks to goals and filters due times with half-open bounds', async () => {
    const goal = await create('/api/v1/goals', {
      title: 'Learn',
      targetValue: 20,
      unit: 'hours',
    });
    const task = await create('/api/v1/tasks', {
      title: ' Study chapter ',
      goalId: goal.id,
      dueAt: '2026-12-01T10:00:00+01:00',
    });
    expect(task.dueAt).toBe('2026-12-01T09:00:00.000Z');
    expect(task.status).toBe('todo');
    const included = await request(
      'GET',
      `/api/v1/tasks?goalId=${goal.id}&dueFrom=2026-12-01T09:00:00Z&dueTo=2026-12-01T10:00:00Z`,
    );
    expect(
      included.json().items.map((item: { id: string }) => item.id),
    ).toEqual([task.id]);
    expect(
      (
        await request(
          'GET',
          `/api/v1/tasks?dueTo=2026-12-01T09:00:00Z&goalId=${goal.id}`,
        )
      ).json().items,
    ).toEqual([]);
    const changed = await request('PATCH', `/api/v1/tasks/${task.id}`, {
      status: 'done',
      dueAt: null,
    });
    expect(changed.statusCode, changed.body).toBe(200);
    expect(changed.json().dueAt).toBeNull();
    expect(changed.json().goalId).toBe(goal.id);
  });
  it('schedules events across DST, filters overlaps, and validates partial intervals atomically', async () => {
    const task = await create('/api/v1/tasks', { title: 'Revision' });
    const event = await create('/api/v1/schedule/events', {
      title: 'Review',
      taskId: task.id,
      startsAt: '2026-10-25T02:30:00+02:00',
      endsAt: '2026-10-25T02:15:00+01:00',
      timeZone: 'Europe/Madrid',
    });
    expect(event.startsAt).toBe('2026-10-25T00:30:00.000Z');
    expect(event.endsAt).toBe('2026-10-25T01:15:00.000Z');
    const overlap = await request(
      'GET',
      `/api/v1/schedule/events?taskId=${task.id}&from=2026-10-25T01:00:00Z&to=2026-10-25T02:00:00Z`,
    );
    expect(overlap.json().items.map((item: { id: string }) => item.id)).toEqual(
      [event.id],
    );
    expect(
      (
        await request(
          'GET',
          `/api/v1/schedule/events?taskId=${task.id}&from=2026-10-25T01:15:00Z`,
        )
      ).json().items,
    ).toEqual([]);
    expect(
      (
        await request('PATCH', `/api/v1/schedule/events/${event.id}`, {
          endsAt: '2026-10-25T00:00:00Z',
        })
      ).statusCode,
    ).toBe(400);
    // Either ordering would make the merged interval invalid if both writes used stale reads.
    const results = await Promise.all([
      request('PATCH', `/api/v1/schedule/events/${event.id}`, {
        startsAt: '2026-10-25T01:00:00Z',
      }),
      request('PATCH', `/api/v1/schedule/events/${event.id}`, {
        endsAt: '2026-10-25T00:45:00Z',
      }),
    ]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([
      200, 400,
    ]);
    const final = (
      await request('GET', `/api/v1/schedule/events/${event.id}`)
    ).json();
    expect(Date.parse(final.endsAt)).toBeGreaterThan(
      Date.parse(final.startsAt),
    );
  });
  it('prevents cross-user reads, mutations, deletion, logs, and relationship reassignment', async () => {
    const goal = await create('/api/v1/goals', {
      title: 'Private goal',
      targetValue: 1,
      unit: 'course',
    });
    const habit = await create('/api/v1/habits', {
      title: 'Private habit',
      goalId: goal.id,
    });
    const task = await create('/api/v1/tasks', {
      title: 'Private task',
      goalId: goal.id,
    });
    const event = await create('/api/v1/schedule/events', {
      title: 'Private event',
      taskId: task.id,
      startsAt: '2026-12-01T10:00:00Z',
      endsAt: '2026-12-01T11:00:00Z',
      timeZone: 'UTC',
    });
    for (const [path, item] of [
      ['goals', goal],
      ['habits', habit],
      ['tasks', task],
      ['schedule/events', event],
    ] as const) {
      for (const method of ['GET', 'PATCH', 'DELETE'] as HTTPMethods[]) {
        const response = await request(
          method,
          `/api/v1/${path}/${item.id}`,
          method === 'PATCH' ? { title: 'Stolen' } : undefined,
          bob.accessToken,
        );
        expect(response.statusCode, response.body).toBe(404);
      }
      const list = await request(
        'GET',
        `/api/v1/${path}`,
        undefined,
        bob.accessToken,
      );
      expect(list.body).not.toContain(item.id);
    }
    for (const method of ['GET', 'POST'] as HTTPMethods[])
      expect(
        (
          await request(
            method,
            `/api/v1/habits/${habit.id}/logs`,
            method === 'POST'
              ? { date: '2026-12-01', completed: true }
              : undefined,
            bob.accessToken,
          )
        ).statusCode,
      ).toBe(404);
    expect(
      (
        await request(
          'POST',
          '/api/v1/tasks',
          { title: 'Cross owner', goalId: goal.id },
          bob.accessToken,
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await request(
          'POST',
          '/api/v1/habits',
          { title: 'Cross owner', goalId: goal.id },
          bob.accessToken,
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await request(
          'POST',
          '/api/v1/schedule/events',
          {
            title: 'Cross owner',
            taskId: task.id,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            timeZone: 'UTC',
          },
          bob.accessToken,
        )
      ).statusCode,
    ).toBe(404);
    await expect(
      life.goals.update(bob.accessToken, goal.id, { currentValue: 99 }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      life.habits.log(bob.accessToken, habit.id, {
        date: '2026-12-01',
        completed: true,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      life.tasks.delete(bob.accessToken, task.id),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      life.scheduling.update(bob.accessToken, event.id, { title: 'Stolen' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it('enforces ownership foreign keys and detaches links without deleting independent records', async () => {
    const goal = await create('/api/v1/goals', {
      title: 'Disposable link',
      targetValue: 2,
      unit: 'hours',
    });
    const habit = await create('/api/v1/habits', {
      title: 'Keep habit',
      goalId: goal.id,
    });
    const task = await create('/api/v1/tasks', {
      title: 'Keep task',
      goalId: goal.id,
    });
    const event = await create('/api/v1/schedule/events', {
      title: 'Keep event',
      taskId: task.id,
      startsAt: '2026-12-02T10:00:00Z',
      endsAt: '2026-12-02T11:00:00Z',
      timeZone: 'UTC',
    });
    await expect(
      db.db.execute(
        sql`insert into tasks (user_id,title,goal_id) values (${bob.user.id}::uuid,'Cross owner',${goal.id}::uuid)`,
      ),
    ).rejects.toThrow();
    await request('DELETE', `/api/v1/goals/${goal.id}`);
    expect(
      (await request('GET', `/api/v1/tasks/${task.id}`)).json().goalId,
    ).toBeNull();
    expect(
      (await request('GET', `/api/v1/habits/${habit.id}`)).json().goalId,
    ).toBeNull();
    await request('DELETE', `/api/v1/tasks/${task.id}`);
    const detached = (
      await request('GET', `/api/v1/schedule/events/${event.id}`)
    ).json();
    expect(detached.taskId).toBeNull();
    expect(Date.parse(detached.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(event.updatedAt),
    );
    await request('POST', `/api/v1/habits/${habit.id}/logs`, {
      date: '2026-12-02',
      completed: true,
    });
    await request('DELETE', `/api/v1/habits/${habit.id}`);
    const logs = await db.db.execute(
      sql`select count(*)::int as count from habit_logs where habit_id=${habit.id}::uuid`,
    );
    expect(logs[0]?.count).toBe(0);
  });
  it('rejects a related goal deleted between public validation and persistence', async () => {
    const goal = await life.goals.create(alice.accessToken, {
      title: 'Racing parent',
      targetValue: 1,
      unit: 'course',
    });
    const racing = createTasksService(db.db, identity, {
      get: async (token, id) => {
        const owned = await life.goals.get(token, id);
        await life.goals.delete(token, id);
        return owned;
      },
    });
    await expect(
      racing.create(alice.accessToken, {
        title: 'Must not persist',
        goalId: goal.id,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    const tasks = await life.tasks.list(alice.accessToken, { goalId: goal.id });
    expect(tasks.items).toEqual([]);
  });
  it('validates inputs and authenticates all application operations, including expired/revoked tokens', async () => {
    for (const path of ['/goals', '/habits', '/tasks', '/schedule/events']) {
      const unauth = await request('GET', '/api/v1' + path, undefined, '');
      expect(unauth.statusCode).toBe(401);
      expect(unauth.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(unauth.headers['cache-control']).toBe('no-store');
      expect(
        (
          await request('POST', '/api/v1' + path, {
            title: 'Hidden',
            userId: bob.user.id,
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await request('POST', '/api/v1/goals', {
          title: '  ',
          targetValue: 1,
          unit: 'hours',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request('POST', '/api/v1/goals', {
          title: 'Bad',
          targetValue: 0,
          unit: 'hours',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request(
          'GET',
          '/api/v1/tasks?dueFrom=2026-12-02T00:00:00Z&dueTo=2026-12-01T00:00:00Z',
        )
      ).statusCode,
    ).toBe(400);
    const expired = createLifeManagement(
      db.db,
      createIdentityService(db.db, () => new Date(Date.now() + 8 * 86400000)),
    );
    for (const services of [expired, createLifeManagement(db.db, identity)]) {
      const token = services === expired ? alice.accessToken : undefined;
      await expect(services.goals.list(token)).rejects.toMatchObject({
        statusCode: 401,
      });
      await expect(services.habits.list(token)).rejects.toMatchObject({
        statusCode: 401,
      });
      await expect(
        services.tasks.create(token, { title: 'Unauthorized' }),
      ).rejects.toMatchObject({ statusCode: 401 });
      await expect(services.scheduling.list(token)).rejects.toMatchObject({
        statusCode: 401,
      });
    }
    const session = await identity.login({
      email: (await identity.me(alice.accessToken)).email,
      password: 'a long integration password',
    });
    await identity.logout(session.accessToken);
    await expect(life.goals.list(session.accessToken)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});
