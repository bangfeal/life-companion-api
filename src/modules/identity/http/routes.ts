import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from 'typebox';
import type { IdentityService } from '../application/service.js';
import { ProblemSchema } from '../../../shared/problem.js';

const Credentials = Type.Object(
  {
    email: Type.String({
      format: 'email',
      maxLength: 254,
      examples: ['user@example.com'],
    }),
    password: Type.String({
      minLength: 15,
      maxLength: 128,
      writeOnly: true,
      description: '15–128 characters; never trimmed or truncated.',
    }),
  },
  { additionalProperties: false },
);
const User = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    email: Type.String({ format: 'email' }),
    createdAt: Type.String({ format: 'date-time' }),
    profile: Type.Object(
      {
        displayName: Type.Union([Type.String(), Type.Null()]),
        timeZone: Type.String(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
const Session = Type.Object(
  {
    accessToken: Type.String({
      description:
        'Opaque token; send in Authorization: Bearer <token>. Returned only at issuance.',
    }),
    tokenType: Type.Literal('Bearer'),
    expiresAt: Type.String({ format: 'date-time' }),
    user: User,
  },
  { additionalProperties: false },
);
const Patch = Type.Object(
  {
    displayName: Type.Optional(
      Type.Union([Type.String({ minLength: 1, maxLength: 100 }), Type.Null()]),
    ),
    timeZone: Type.Optional(
      Type.String({
        minLength: 1,
        maxLength: 100,
        examples: ['Europe/Madrid'],
      }),
    ),
  },
  { additionalProperties: false, minProperties: 1 },
);
const problem = (description: string) => ({
  description,
  content: { 'application/problem+json': { schema: ProblemSchema } },
});
const errors = {
  400: problem('Invalid input'),
  401: problem('Missing, invalid, expired or revoked credentials'),
  413: problem('Request body exceeds 4 KiB'),
  415: problem('Unsupported content type'),
  409: problem('Registration could not be completed'),
  429: problem('Rate limit exceeded; retry after the Retry-After header'),
  500: problem('Unexpected failure'),
  503: problem('Identity unavailable or password capacity exceeded'),
};
const security = [{ bearerAuth: [] }];
const EmptyQuery = Type.Object({}, { additionalProperties: false });
function token(request: FastifyRequest) {
  const header = request.headers.authorization;
  const match = header?.match(/^Bearer ([A-Za-z0-9_-]{43})$/i);
  return match?.[1];
}
export async function registerIdentityRoutes(
  app: FastifyInstance,
  service?: IdentityService,
) {
  const routes = app.withTypeProvider<TypeBoxTypeProvider>();
  function identity() {
    if (!service)
      throw Object.assign(new Error('Identity unavailable'), {
        statusCode: 503,
      });
    return service;
  }
  // In a scoped plugin: prevent caches from retaining private responses, including errors.
  routes.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
  });
  const authLimit = { max: 10, timeWindow: '1 minute' };
  routes.post(
    '/auth/register',
    {
      bodyLimit: 4096,
      config: { rateLimit: authLimit },
      schema: {
        tags: ['Identity'],
        querystring: EmptyQuery,
        summary: 'Register an account and issue a seven-day session',
        description:
          'Email is case-insensitive. Duplicate registration returns 409. No email verification is performed.',
        body: Credentials,
        response: { ...errors, 201: Session },
      },
    },
    async (request, reply) => {
      const result = await identity().register(request.body);
      return reply.code(201).send(result);
    },
  );
  routes.post(
    '/auth/login',
    {
      bodyLimit: 4096,
      config: { rateLimit: authLimit },
      schema: {
        tags: ['Identity'],
        querystring: EmptyQuery,
        summary: 'Issue a new seven-day bearer session',
        description:
          'Unknown accounts and incorrect passwords return the same 401 response.',
        body: Credentials,
        response: { ...errors, 200: Session },
      },
    },
    async (request) => identity().login(request.body),
  );
  routes.post(
    '/auth/logout',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Identity'],
        querystring: EmptyQuery,
        summary: 'Revoke the presented session only',
        description:
          'Other sessions remain valid. Repeating logout with the revoked token returns 401.',
        security,
        response: {
          ...errors,
          204: Type.Null({
            description: 'Session revoked; empty response body',
          }),
        },
      },
    },
    async (request, reply) => {
      await identity().logout(token(request));
      return reply.code(204).send(null);
    },
  );
  routes.get(
    '/me',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        tags: ['Identity'],
        querystring: EmptyQuery,
        summary: 'Read the authenticated user and profile',
        security,
        response: { ...errors, 200: User },
      },
    },
    async (request) => identity().me(token(request)),
  );
  routes.patch(
    '/me',
    {
      bodyLimit: 4096,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Identity'],
        querystring: EmptyQuery,
        summary: 'Update only the authenticated user profile',
        description:
          'Omitted fields remain unchanged. A null displayName clears it; timeZone must be UTC or a recognized IANA zone. Identity and email cannot be changed here.',
        security,
        body: Patch,
        response: { ...errors, 200: User },
      },
    },
    async (request) => identity().updateProfile(token(request), request.body),
  );
}
