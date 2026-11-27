import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from 'typebox';
import type { HabitsService } from '../application/service.js';
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
  DateOnly,
} from '../../../shared/http/resource.js';
const Title = Type.String({ minLength: 1, maxLength: 200 });
const NullableId = Type.Union([Id, Type.Null()]);
const Zone = Type.String({
  minLength: 1,
  maxLength: 100,
  examples: ['Europe/Madrid'],
});
const Properties = {
  title: Title,
  goalId: Type.Optional(NullableId),
  timeZone: Type.Optional(Zone),
  archived: Type.Optional(Type.Boolean()),
};
const Create = Type.Required(Type.Pick(Type.Object(Properties), ['title']));
const Input = Type.Object(
  { ...Properties, ...Create.properties },
  { additionalProperties: false },
);
const Patch = Type.Partial(
  Type.Omit(
    Type.Object(Properties, { additionalProperties: false, minProperties: 1 }),
    ['timeZone'],
  ),
);
const Output = Type.Object(
  {
    ...baseProperties,
    title: Title,
    goalId: NullableId,
    timeZone: Zone,
    archived: Type.Boolean(),
  },
  { additionalProperties: false },
);
const Query = Type.Object(
  {
    ...pageProperties,
    archived: Type.Optional(Type.Boolean()),
    goalId: Type.Optional(Id),
  },
  { additionalProperties: false },
);
export async function registerRoutes(
  app: FastifyInstance,
  service?: HabitsService,
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
    tags: ['Habits'],
    security,
    description:
      'Daily habits. Timezone is fixed at creation so historical local dates keep their meaning. Logs are one completion value per local date; repeated writes replace that value.',
  };
  routes.post(
    '/habits',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Create habit',
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
    '/habits',
    {
      schema: {
        ...common,
        summary: 'List owned habits',
        querystring: Query,
        response: { ...resourceErrors, 200: pageSchema(Output) },
      },
    },
    async (request) => useService().list(bearer(request), request.query),
  );
  routes.get(
    '/habits/:id',
    {
      schema: {
        ...common,
        summary: 'Read owned habit',
        params: IdParams,
        querystring: EmptyQuery,
        response: { ...resourceErrors, 200: Output },
      },
    },
    async (request) => useService().get(bearer(request), request.params.id),
  );
  routes.patch(
    '/habits/:id',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Update owned habit',
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
    '/habits/:id',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Delete owned habit',
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

  const LogInput = Type.Object(
    { date: DateOnly, completed: Type.Boolean() },
    { additionalProperties: false },
  );
  const LogOutput = Type.Object(
    {
      ...LogInput.properties,
      createdAt: baseProperties.createdAt,
      updatedAt: baseProperties.updatedAt,
    },
    { additionalProperties: false },
  );
  const LogQuery = Type.Object(
    {
      ...pageProperties,
      fromDate: Type.Optional(DateOnly),
      toDate: Type.Optional(DateOnly),
    },
    { additionalProperties: false },
  );
  routes.post(
    '/habits/:id/logs',
    {
      bodyLimit: 4096,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Set completion for one local date (retry-safe)',
        params: IdParams,
        querystring: EmptyQuery,
        body: LogInput,
        response: { ...resourceErrors, 200: LogOutput },
      },
    },
    async (request) =>
      useService().log(bearer(request), request.params.id, request.body),
  );
  routes.get(
    '/habits/:id/logs',
    {
      schema: {
        ...common,
        summary: 'List habit logs; date bounds are inclusive',
        params: IdParams,
        querystring: LogQuery,
        response: { ...resourceErrors, 200: pageSchema(LogOutput) },
      },
    },
    async (request) =>
      useService().logs(bearer(request), request.params.id, request.query),
  );
}
