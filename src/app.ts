import Fastify, {
  LogController,
  type FastifyError,
  type FastifyServerOptions,
} from 'fastify';
import rateLimit from '@fastify/rate-limit';
import {
  registerIdentityRoutes,
  type IdentityService,
} from './modules/identity/index.js';
import swagger from '@fastify/swagger';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from 'typebox';
import { ProblemSchema } from './shared/problem.js';

export async function buildApp(
  options: FastifyServerOptions = {},
  identity?: IdentityService,
) {
  const app = Fastify({
    ...options,
    ajv: { customOptions: { removeAdditional: false } },
    logController: new LogController({ disableRequestLogging: true }),
  }).withTypeProvider<TypeBoxTypeProvider>();
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'Life Companion API', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            description: 'Opaque, revocable session token. Not a JWT.',
          },
        },
      },
    },
  });
  await app.register(rateLimit, {
    global: false,
    max: 10,
    timeWindow: '1 minute',
    cache: 10000,
  });
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const status =
      error.statusCode &&
      error.statusCode >= 400 &&
      (error.statusCode < 500 || error.statusCode === 503)
        ? error.statusCode
        : 500;
    // Do not log error messages, bodies, URLs, or validation values: they can contain private data.
    if (status === 500)
      request.log.error({ requestId: request.id }, 'Request failed');
    const titles: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      404: 'Not Found',
      409: 'Conflict',
      413: 'Content Too Large',
      415: 'Unsupported Media Type',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      503: 'Service Unavailable',
    };
    const title = titles[status] ?? 'Request Error';
    if (status === 401) reply.header('WWW-Authenticate', 'Bearer');
    if (status === 503) reply.header('Retry-After', '1');
    void reply
      .code(status)
      .type('application/problem+json')
      .send({
        type: 'about:blank',
        title,
        status,
        detail:
          status === 500
            ? 'An unexpected error occurred.'
            : 'The request could not be processed.',
      });
  });
  app.setNotFoundHandler((_request, reply) => {
    void reply.code(404).type('application/problem+json').send({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'The requested resource does not exist.',
    });
  });
  app.get(
    '/health',
    {
      schema: {
        summary: 'Process liveness (does not check PostgreSQL)',
        tags: ['System'],
        response: {
          200: Type.Object(
            { status: Type.Literal('ok') },
            { additionalProperties: false },
          ),
          500: {
            description: 'Unexpected server failure',
            content: { 'application/problem+json': { schema: ProblemSchema } },
          },
        },
      },
    },
    async () => ({ status: 'ok' as const }),
  );
  app.get('/openapi.json', { schema: { hide: true } }, async () =>
    app.swagger(),
  );
  await app.register(async (scope) => registerIdentityRoutes(scope, identity), {
    prefix: '/api/v1',
  });
  return app;
}
