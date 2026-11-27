import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import type { HTTPMethods } from 'fastify';
import { createDatabase } from '../../src/infrastructure/database/client.js';
import { createIdentityService } from '../../src/modules/identity/index.js';
import { createLifeManagement } from '../../src/life-management.js';
import { buildApp } from '../../src/app.js';
let db: ReturnType<typeof createDatabase>;
let identity: ReturnType<typeof createIdentityService>;
let life: ReturnType<typeof createLifeManagement>;
let app: Awaited<ReturnType<typeof buildApp>>;
let alice: { accessToken: string; user: { id: string } };
let bob: typeof alice;
const accounts: string[] = [];
const window = 'from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z&timeZone=UTC';
function sleepInput(day: string) {
  return {
    startsAt: `2026-10-${day}T00:00:00Z`,
    endsAt: `2026-10-${day}T08:00:00Z`,
    timeZone: 'Europe/Madrid',
    awakeMinutes: 30,
  };
}
function studyInput(day: string) {
  return {
    subject: 'Mathematics',
    startsAt: `2026-10-${day}T09:00:00Z`,
    endsAt: `2026-10-${day}T10:30:00Z`,
    timeZone: 'Europe/Madrid',
    breakMinutes: 15,
  };
}
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
  const result = await request('POST', path, payload, token);
  expect(result.statusCode, result.body).toBe(201);
  return result.json();
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
    const account = await identity.register({
      email: `${name}-sleep-study-${randomUUID()}@example.test`,
      password: 'long integration test password',
    });
    accounts.push(account.user.id);
    if (name === 'alice') alice = account;
    else bob = account;
  }
}, 20000);
afterAll(async () => {
  await app?.close();
  if (db) {
    for (const id of accounts)
      await db.db.execute(sql`delete from users where id=${id}::uuid`);
    await db.close();
  }
});

describe('M4/M5 HTTP → public application services → PostgreSQL', () => {
  it('records sleep history and edits derived duration and reported quality', async () => {
    const row = await create('/api/v1/sleep/sessions', {
      ...sleepInput('01'),
      quality: 4,
      notes: 'Manual entry',
    });
    expect(row.sleepMinutes).toBe(450);
    expect(row.durationMinutes).toBe(480);
    expect(row.provenance).toBe('manual');
    expect(row.userId).toBeUndefined();
    const changed = await request('PATCH', `/api/v1/sleep/sessions/${row.id}`, {
      awakeMinutes: 60,
      notes: null,
    });
    expect(changed.statusCode, changed.body).toBe(200);
    expect(changed.json().sleepMinutes).toBe(420);
    expect(changed.json().notes).toBeNull();
    expect(
      (
        await request('PATCH', `/api/v1/sleep/sessions/${row.id}`, {
          awakeMinutes: 480,
        })
      ).statusCode,
    ).toBe(400);
    const history = await request(
      'GET',
      '/api/v1/sleep/sessions?limit=1&from=2026-10-01T07:00:00Z&to=2026-10-01T09:00:00Z',
    );
    expect(history.json().items[0].id).toBe(row.id);
    expect(
      (await request('GET', `/api/v1/sleep/sessions/${row.id}`)).json()
        .sleepMinutes,
    ).toBe(420);
  });
  it('rejects overlapping intervals under concurrent inserts while accepting adjacent sessions', async () => {
    const results = await Promise.all([
      request('POST', '/api/v1/sleep/sessions', sleepInput('02')),
      request('POST', '/api/v1/sleep/sessions', sleepInput('02')),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const surviving = results
      .find((result) => result.statusCode === 201)!
      .json();
    expect(
      (
        await request('PATCH', `/api/v1/sleep/sessions/${surviving.id}`, {
          startsAt: '2026-10-01T07:00:00Z',
        })
      ).statusCode,
    ).toBe(409);
    const adjacent = await create('/api/v1/sleep/sessions', {
      startsAt: '2026-10-02T08:00:00Z',
      endsAt: '2026-10-02T08:30:00Z',
      timeZone: 'UTC',
      kind: 'nap',
    });
    expect(adjacent.sleepMinutes).toBe(30);
    await create('/api/v1/sleep/sessions', sleepInput('02'), bob.accessToken);
    const study = await Promise.all([
      request('POST', '/api/v1/study/sessions', studyInput('02')),
      request('POST', '/api/v1/study/sessions', studyInput('02')),
    ]);
    expect(study.map((r) => r.statusCode).sort()).toEqual([201, 409]);
  });
  it('summarizes by ending instant rather than clipping overlapping history', async () => {
    await create('/api/v1/sleep/sessions', {
      startsAt: '2026-09-29T23:00:00Z',
      endsAt: '2026-09-30T07:00:00Z',
      timeZone: 'UTC',
    });
    await create(
      '/api/v1/sleep/sessions',
      {
        startsAt: '2026-09-30T23:00:00Z',
        endsAt: '2026-10-01T07:00:00Z',
        timeZone: 'UTC',
      },
      bob.accessToken,
    );
    const boundary = await request(
      'GET',
      '/api/v1/sleep/summary?from=2026-09-30T07:00:00Z&to=2026-10-01T00:00:00Z&timeZone=America/New_York',
    );
    expect(boundary.statusCode, boundary.body).toBe(200);
    expect(boundary.json().sessionCount).toBe(1);
    expect(boundary.json().totalSleepMinutes).toBe(480);
    expect(boundary.json().daily[0].date).toBe('2026-09-30');
    const excluded = await request(
      'GET',
      '/api/v1/sleep/summary?from=2026-09-29T00:00:00Z&to=2026-09-30T07:00:00Z',
    );
    expect(excluded.json().sessionCount).toBe(0);
  });
  it('records subject-specific study, examinations, and coherent result edits', async () => {
    const exam = await create('/api/v1/examinations', {
      title: 'Algebra',
      subject: 'Mathematics',
      scheduledAt: '2026-10-15T10:00:00Z',
      timeZone: 'Europe/Madrid',
    });
    const task = await create('/api/v1/tasks', { title: 'Prepare algebra' });
    const row = await create('/api/v1/study/sessions', {
      ...studyInput('03'),
      taskId: task.id,
      examinationId: exam.id,
      activity: 'review',
    });
    expect(row.focusedMinutes).toBe(75);
    expect(row.provenance).toBe('manual');
    const changed = await request('PATCH', `/api/v1/study/sessions/${row.id}`, {
      breakMinutes: 30,
    });
    expect(changed.statusCode, changed.body).toBe(200);
    expect(changed.json().focusedMinutes).toBe(60);
    expect(
      (
        await request('PATCH', `/api/v1/study/sessions/${row.id}`, {
          endsAt: '2026-10-03T09:15:00Z',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await request('PATCH', `/api/v1/examinations/${exam.id}`, { score: 18 }))
        .statusCode,
    ).toBe(400);
    const graded = await request('PATCH', `/api/v1/examinations/${exam.id}`, {
      status: 'completed',
      score: 18,
      maxScore: 20,
    });
    expect(graded.statusCode, graded.body).toBe(200);
    expect(graded.json().scorePercent).toBe(90);
    expect(
      (
        await request('PATCH', `/api/v1/examinations/${exam.id}`, {
          maxScore: 10,
        })
      ).statusCode,
    ).toBe(400);
    const filtered = await request(
      'GET',
      `/api/v1/study/sessions?subject=Mathematics&examinationId=${exam.id}`,
    );
    expect(filtered.json().items[0].id).toBe(row.id);
    const exams = await request(
      'GET',
      '/api/v1/examinations?status=completed&from=2026-10-15T10:00:00Z&to=2026-10-16T00:00:00Z',
    );
    expect(exams.json().items[0].id).toBe(exam.id);
    const summary = await request('GET', '/api/v1/study/summary?' + window);
    expect(summary.statusCode, summary.body).toBe(200);
    expect(summary.json().examinations.averageScorePercent).toBe(90);
    expect(summary.json().subjects[0].subject).toBe('Mathematics');
    await request('DELETE', `/api/v1/examinations/${exam.id}`);
    expect(
      (await request('GET', `/api/v1/study/sessions/${row.id}`)).json()
        .examinationId,
    ).toBeNull();
    await request('DELETE', `/api/v1/tasks/${task.id}`);
    expect(
      (await request('GET', `/api/v1/study/sessions/${row.id}`)).json().taskId,
    ).toBeNull();
  });
  it('schedules owned todo study tasks through the published scheduling capability', async () => {
    const task = await create('/api/v1/tasks', { title: 'Review calculus' });
    const input = {
      subject: 'Calculus',
      startsAt: '2026-12-01T09:00:00Z',
      endsAt: '2026-12-01T10:00:00Z',
      timeZone: 'Europe/Madrid',
    };
    const event = await create(
      `/api/v1/study/tasks/${task.id}/schedule`,
      input,
    );
    expect(event.taskId).toBe(task.id);
    expect(event.title).toBe('Study: Calculus');
    const scheduled = await request(
      'GET',
      `/api/v1/schedule/events?taskId=${task.id}`,
    );
    expect(scheduled.json().items[0].id).toBe(event.id);
    expect(
      (
        await request(
          'POST',
          `/api/v1/study/tasks/${task.id}/schedule`,
          input,
          bob.accessToken,
        )
      ).statusCode,
    ).toBe(404);
    await request('PATCH', `/api/v1/tasks/${task.id}`, { status: 'done' });
    expect(
      (await request('POST', `/api/v1/study/tasks/${task.id}/schedule`, input))
        .statusCode,
    ).toBe(409);
  });
  it('combines public sleep and education summaries without inventing missing observations', async () => {
    const summary = await request(
      'GET',
      '/api/v1/analytics/sleep-study?' + window,
    );
    expect(summary.statusCode, summary.body).toBe(200);
    const result = summary.json();
    expect(result.sleep.sessionCount).toBeGreaterThan(0);
    expect(result.education.sessionCount).toBeGreaterThan(0);
    expect(
      result.daily.find((day: { date: string }) => day.date === '2026-10-01')
        .studyMinutes,
    ).toBeNull();
    expect(
      result.daily.find((day: { date: string }) => day.date === '2026-10-03')
        .sleepMinutes,
    ).toBeNull();
    const direct = await life.analytics.sleepStudy(alice.accessToken, {
      from: '2026-10-01T00:00:00Z',
      to: '2026-11-01T00:00:00Z',
      timeZone: 'UTC',
    });
    expect(direct).toEqual(result);
    expect(result.interpretation).toContain('No causal');
    const empty = await request(
      'GET',
      '/api/v1/analytics/sleep-study?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z',
    );
    expect(empty.json().daily).toEqual([]);
    expect(empty.json().sleep.averageSleepMinutes).toBeNull();
  });
  it('isolates reads, edits, deletion, linked references, and summary windows between users', async () => {
    const sleep = await create('/api/v1/sleep/sessions', sleepInput('04'));
    const exam = await create('/api/v1/examinations', {
      title: 'Private exam',
      subject: 'Math',
      scheduledAt: '2026-10-20T10:00:00Z',
      timeZone: 'UTC',
    });
    const task = await create('/api/v1/tasks', {
      title: 'Private preparation',
    });
    const study = await create('/api/v1/study/sessions', {
      ...studyInput('04'),
      taskId: task.id,
      examinationId: exam.id,
    });
    for (const [path, row, patch] of [
      ['sleep/sessions', sleep, { notes: 'Stolen' }],
      ['study/sessions', study, { subject: 'Stolen' }],
      ['examinations', exam, { title: 'Stolen' }],
    ] as const) {
      for (const method of ['GET', 'PATCH', 'DELETE'] as HTTPMethods[])
        expect(
          (
            await request(
              method,
              `/api/v1/${path}/${row.id}`,
              method === 'PATCH' ? patch : undefined,
              bob.accessToken,
            )
          ).statusCode,
        ).toBe(404);
      expect(
        (await request('GET', `/api/v1/${path}`, undefined, bob.accessToken))
          .body,
      ).not.toContain(row.id);
    }
    expect(
      (
        await request(
          'POST',
          '/api/v1/study/sessions',
          { ...studyInput('06'), taskId: task.id },
          bob.accessToken,
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await request(
          'POST',
          '/api/v1/study/sessions',
          { ...studyInput('06'), examinationId: exam.id },
          bob.accessToken,
        )
      ).statusCode,
    ).toBe(404);
    await expect(
      life.sleep.update(bob.accessToken, sleep.id, { notes: 'Stolen' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      life.education.updateSession(bob.accessToken, study.id, {
        subject: 'Stolen',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      life.education.deleteExam(bob.accessToken, exam.id),
    ).rejects.toMatchObject({ statusCode: 404 });
    const bobSummary = (
      await request(
        'GET',
        '/api/v1/analytics/sleep-study?' + window,
        undefined,
        bob.accessToken,
      )
    ).json();
    expect(bobSummary.education.sessionCount).toBe(0);
    expect(bobSummary.sleep.sessionCount).toBe(2);
    await expect(
      db.db.execute(
        sql`insert into study_sessions(user_id,subject,starts_at,ends_at,time_zone,examination_id) values (${bob.user.id}::uuid,'Other','2026-10-06T09:00:00Z','2026-10-06T10:00:00Z','UTC',${exam.id}::uuid)`,
      ),
    ).rejects.toThrow();
  });
  it('rejects invalid input and requires authentication for direct and HTTP summary calls', async () => {
    for (const path of [
      '/sleep/sessions',
      '/study/sessions',
      '/examinations',
      '/sleep/summary?' + window,
      '/study/summary?' + window,
      '/analytics/sleep-study?' + window,
    ]) {
      const response = await request('GET', '/api/v1' + path, undefined, '');
      expect(response.statusCode).toBe(401);
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(
      (
        await request('POST', '/api/v1/sleep/sessions', {
          ...sleepInput('07'),
          endsAt: '2027-01-01T00:00:00Z',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request('POST', '/api/v1/study/sessions', {
          ...studyInput('07'),
          userId: bob.user.id,
        })
      ).statusCode,
    ).toBe(400);
    for (const path of [
      '/sleep/summary',
      '/study/summary',
      '/analytics/sleep-study',
    ]) {
      expect(
        (
          await request(
            'GET',
            '/api/v1' +
              path +
              '?from=2026-01-01T00:00:00Z&to=2026-12-31T00:00:00Z',
          )
        ).statusCode,
      ).toBe(400);
      expect((await request('GET', '/api/v1' + path)).statusCode).toBe(400);
    }
    const expired = createLifeManagement(
      db.db,
      createIdentityService(db.db, () => new Date(Date.now() + 8 * 86400000)),
    );
    for (const services of [expired, life]) {
      const token = services === expired ? alice.accessToken : undefined;
      await expect(services.sleep.list(token)).rejects.toMatchObject({
        statusCode: 401,
      });
      await expect(
        services.education.listSessions(token),
      ).rejects.toMatchObject({ statusCode: 401 });
      await expect(
        services.analytics.sleepStudy(token, {
          from: '2026-10-01T00:00:00Z',
          to: '2026-11-01T00:00:00Z',
        }),
      ).rejects.toMatchObject({ statusCode: 401 });
    }
  });
  it('deletes owned observations and leaves other users independent', async () => {
    const row = await create('/api/v1/sleep/sessions', sleepInput('08'));
    expect(
      (await request('DELETE', `/api/v1/sleep/sessions/${row.id}`)).statusCode,
    ).toBe(204);
    expect(
      (await request('GET', `/api/v1/sleep/sessions/${row.id}`)).statusCode,
    ).toBe(404);
    const session = await create('/api/v1/study/sessions', studyInput('08'));
    expect(
      (await request('DELETE', `/api/v1/study/sessions/${session.id}`))
        .statusCode,
    ).toBe(204);
    expect(
      (await request('GET', `/api/v1/study/sessions/${session.id}`)).statusCode,
    ).toBe(404);
  });
});
