import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from 'typebox';
import type { SleepService } from '../application/service.js';
import { ApplicationError } from '../../../shared/domain/validation.js';
import {
  bearer,
  EmptyQuery,
  IdParams,
  Instant,
  pageProperties,
  pageSchema,
  resourceErrors,
  security,
} from '../../../shared/http/resource.js';
import { WindowSchema } from '../../../shared/http/time.js';
import {
  SleepInputSchema,
  SleepPatchSchema,
  SleepSchema,
  SleepSummarySchema,
} from './contracts.js';
export async function registerRoutes(
  app: FastifyInstance,
  service?: SleepService,
) {
  const routes = app.withTypeProvider<TypeBoxTypeProvider>();
  function useService() {
    if (!service) throw new ApplicationError(503);
    return service;
  }
  routes.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
  });
  const common = { tags: ['Sleep'], security };

  const SleepQuery = Type.Object(
    {
      ...pageProperties,
      from: Type.Optional(Instant),
      to: Type.Optional(Instant),
      kind: Type.Optional(
        Type.Union([Type.Literal('main'), Type.Literal('nap')]),
      ),
    },
    { additionalProperties: false },
  );
  routes.post(
    '/sleep/sessions',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Create sleep record',
        description:
          'Completed reported sleep intervals, up to 48 hours. Overlap is rejected per user, including naps. History uses overlap filters [from,to).',
        body: SleepInputSchema,
        querystring: EmptyQuery,
        response: { ...resourceErrors, 201: SleepSchema },
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(await useService().create(bearer(request), request.body)),
  );
  routes.get(
    '/sleep/sessions',
    {
      schema: {
        ...common,
        summary: 'List owned sleep records',
        description:
          'Completed reported sleep intervals, up to 48 hours. Overlap is rejected per user, including naps. History uses overlap filters [from,to).',
        querystring: SleepQuery,
        response: { ...resourceErrors, 200: pageSchema(SleepSchema) },
      },
    },
    async (request) => useService().list(bearer(request), request.query),
  );
  routes.get(
    '/sleep/sessions/:id',
    {
      schema: {
        ...common,
        summary: 'Read owned sleep record',
        params: IdParams,
        querystring: EmptyQuery,
        response: { ...resourceErrors, 200: SleepSchema },
      },
    },
    async (request) => useService().get(bearer(request), request.params.id),
  );
  routes.patch(
    '/sleep/sessions/:id',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Edit owned sleep record',
        params: IdParams,
        querystring: EmptyQuery,
        body: SleepPatchSchema,
        response: { ...resourceErrors, 200: SleepSchema },
      },
    },
    async (request) =>
      useService().update(bearer(request), request.params.id, request.body),
  );
  routes.delete(
    '/sleep/sessions/:id',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Delete owned sleep record',
        params: IdParams,
        querystring: EmptyQuery,
        response: {
          ...resourceErrors,
          204: Type.Null({ description: 'Deleted; empty body' }),
        },
      },
    },
    async (request, reply) => {
      await useService().delete(bearer(request), request.params.id);
      return reply.code(204).send(null);
    },
  );

  routes.get(
    '/sleep/summary',
    {
      schema: {
        ...common,
        summary: 'Descriptive sleep summary',
        description:
          'Includes complete sessions ending in [from,to), not clipped history overlaps. Assigns full duration to the end local date in the requested timezone. Maximum 93 elapsed days and 10,000 source rows; no recommendations or causal claims.',
        querystring: WindowSchema,
        response: { ...resourceErrors, 200: SleepSummarySchema },
      },
    },
    async (request) => useService().summary(bearer(request), request.query),
  );
}
