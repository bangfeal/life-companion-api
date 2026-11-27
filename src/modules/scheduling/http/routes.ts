import { EventSchema as Output } from './contracts.js';
import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from 'typebox';
import type { SchedulingService } from '../application/service.js';
import { ApplicationError } from '../../../shared/domain/validation.js';
import {
  bearer,
  EmptyQuery,
  IdParams,
  pageProperties,
  pageSchema,
  resourceErrors,
  security,
  Id,
  Instant,
} from '../../../shared/http/resource.js';
const Title = Type.String({ minLength: 1, maxLength: 200 });
const NullableDescription = Type.Union([
  Type.String({ minLength: 1, maxLength: 2000 }),
  Type.Null(),
]);
const NullableId = Type.Union([Id, Type.Null()]);
const Zone = Type.String({
  minLength: 1,
  maxLength: 100,
  examples: ['Europe/Madrid'],
});
const Properties = {
  title: Title,
  description: Type.Optional(NullableDescription),
  taskId: Type.Optional(NullableId),
  startsAt: Instant,
  endsAt: Instant,
  timeZone: Zone,
};
const Create = Type.Required(
  Type.Pick(Type.Object(Properties), [
    'title',
    'startsAt',
    'endsAt',
    'timeZone',
  ]),
);
const Input = Type.Object(
  { ...Properties, ...Create.properties },
  { additionalProperties: false },
);
const Patch = Type.Partial(
  Type.Object(Properties, { additionalProperties: false, minProperties: 1 }),
);
const Query = Type.Object(
  {
    ...pageProperties,
    from: Type.Optional(Instant),
    to: Type.Optional(Instant),
    taskId: Type.Optional(Id),
  },
  { additionalProperties: false },
);
export async function registerRoutes(
  app: FastifyInstance,
  service?: SchedulingService,
) {
  const routes = app.withTypeProvider<TypeBoxTypeProvider>();
  function useService() {
    if (!service) throw new ApplicationError(503);
    return service;
  }
  routes.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
  });
  const common = {
    tags: ['Scheduling'],
    security,
    description:
      'Timed non-recurring events. End must be after start. Explicit offsets are required and stored as UTC; an IANA timezone is retained for display. Filters return events overlapping [from,to). Overlapping events are allowed.',
  };
  routes.post(
    '/schedule/events',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Create event',
        querystring: EmptyQuery,
        body: Input,
        response: { ...resourceErrors, 201: Output },
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(await useService().create(bearer(request), request.body)),
  );
  routes.get(
    '/schedule/events',
    {
      schema: {
        ...common,
        summary: 'List owned events',
        querystring: Query,
        response: { ...resourceErrors, 200: pageSchema(Output) },
      },
    },
    async (request) => useService().list(bearer(request), request.query),
  );
  routes.get(
    '/schedule/events/:id',
    {
      schema: {
        ...common,
        summary: 'Read owned event',
        params: IdParams,
        querystring: EmptyQuery,
        response: { ...resourceErrors, 200: Output },
      },
    },
    async (request) => useService().get(bearer(request), request.params.id),
  );
  routes.patch(
    '/schedule/events/:id',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Update owned event',
        params: IdParams,
        querystring: EmptyQuery,
        body: Patch,
        response: { ...resourceErrors, 200: Output },
      },
    },
    async (request) =>
      useService().update(bearer(request), request.params.id, request.body),
  );
  routes.delete(
    '/schedule/events/:id',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Delete owned event',
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
}
