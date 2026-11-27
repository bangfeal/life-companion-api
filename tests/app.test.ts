import { afterEach, describe, expect, it } from 'vitest';
import { Type } from 'typebox';
import { buildApp } from '../src/app.js';
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
async function setup() {
  const app = await buildApp();
  apps.push(app);
  return app;
}
describe('HTTP foundation', () => {
  it('serves liveness without a database', async () => {
    const app = await setup();
    const response = await app.inject('/health');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
  it('publishes an OpenAPI 3.1 contract with the health response', async () => {
    const app = await setup();
    const response = await app.inject('/openapi.json');
    expect(response.statusCode).toBe(200);
    const spec = response.json();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.paths['/health'].get.responses['200']).toBeDefined();
    expect(
      spec.paths['/api/v1/auth/register'].post.responses['201'],
    ).toBeDefined();
    expect(spec.paths['/api/v1/me'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });
  it('keeps identity routes documented but unavailable without an injected service', async () => {
    const app = await setup();
    const response = await app.inject('/api/v1/me');
    expect(response.statusCode).toBe(503);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.json().title).toBe('Service Unavailable');
  });
  it('returns Problem Details for missing routes', async () => {
    const app = await setup();
    const response = await app.inject('/missing?secret=value');
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.json()).toMatchObject({ type: 'about:blank', status: 404 });
    expect(response.body).not.toContain('secret');
  });
  it('validates inputs and sanitizes internal errors', async () => {
    const app = await setup();
    app.post(
      '/test-validation',
      { schema: { body: Type.Object({ count: Type.Integer() }) } },
      async () => ({ ok: true }),
    );
    app.get('/test-error', async () => {
      throw new Error('private database password');
    });
    const invalid = await app.inject({
      method: 'POST',
      url: '/test-validation',
      payload: { count: 'secret' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().status).toBe(400);
    expect(invalid.body).not.toContain('secret');
    const failure = await app.inject('/test-error');
    expect(failure.statusCode).toBe(500);
    expect(failure.body).not.toContain('password');
  });
});
