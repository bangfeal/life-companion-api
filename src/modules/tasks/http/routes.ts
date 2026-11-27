import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from 'typebox';
import type { TasksService } from '../application/service.js';
import { ApplicationError } from '../../../shared/domain/validation.js';
import {
  baseProperties,
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
const Properties = {
  title: Title,
  description: Type.Optional(NullableDescription),
  goalId: Type.Optional(NullableId),
  dueAt: Type.Optional(Type.Union([Instant, Type.Null()])),
  status: Type.Optional(
    Type.Union([
      Type.Literal('todo'),
      Type.Literal('done'),
      Type.Literal('canceled'),
    ]),
  ),
};
const Create = Type.Required(Type.Pick(Type.Object(Properties), ['title']));
const Input = Type.Object(
  { ...Properties, ...Create.properties },
  { additionalProperties: false },
);
const Patch = Type.Partial(
  Type.Object(Properties, { additionalProperties: false, minProperties: 1 }),
);
const Output = Type.Object(
  {
    ...baseProperties,
    title: Title,
    description: NullableDescription,
    goalId: NullableId,
    dueAt: Type.Union([Instant, Type.Null()]),
    status: Type.Union([
      Type.Literal('todo'),
      Type.Literal('done'),
      Type.Literal('canceled'),
    ]),
  },
  { additionalProperties: false },
);
const Query = Type.Object(
  {
    ...pageProperties,
    status: Type.Optional(
      Type.Union([
        Type.Literal('todo'),
        Type.Literal('done'),
        Type.Literal('canceled'),
      ]),
    ),
    goalId: Type.Optional(Id),
    dueFrom: Type.Optional(Instant),
    dueTo: Type.Optional(Instant),
  },
  { additionalProperties: false },
);
export async function registerRoutes(
  app: FastifyInstance,
  service?: TasksService,
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
    tags: ['Tasks'],
    security,
    description:
      'Due-time filtering uses a half-open interval [dueFrom,dueTo). Tasks without a due time are excluded when a date filter is supplied.',
  };
  routes.post(
    '/tasks',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Create task',
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
    '/tasks',
    {
      schema: {
        ...common,
        summary: 'List owned tasks',
        querystring: Query,
        response: { ...resourceErrors, 200: pageSchema(Output) },
      },
    },
    async (request) => useService().list(bearer(request), request.query),
  );
  routes.get(
    '/tasks/:id',
    {
      schema: {
        ...common,
        summary: 'Read owned task',
        params: IdParams,
        querystring: EmptyQuery,
        response: { ...resourceErrors, 200: Output },
      },
    },
    async (request) => useService().get(bearer(request), request.params.id),
  );
  routes.patch(
    '/tasks/:id',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Update owned task',
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
    '/tasks/:id',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Delete owned task',
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
