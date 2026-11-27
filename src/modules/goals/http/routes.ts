import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from 'typebox';
import type { GoalsService } from '../application/service.js';
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
  DateOnly,
  DomainSchema,
} from '../../../shared/http/resource.js';
const Title = Type.String({ minLength: 1, maxLength: 200 });
const NullableDescription = Type.Union([
  Type.String({ minLength: 1, maxLength: 2000 }),
  Type.Null(),
]);
const Properties = {
  title: Title,
  description: Type.Optional(NullableDescription),
  targetValue: Type.Number({ exclusiveMinimum: 0, maximum: 1e12 }),
  currentValue: Type.Optional(Type.Number({ minimum: 0, maximum: 1e12 })),
  unit: Type.String({ minLength: 1, maxLength: 50 }),
  dueDate: Type.Optional(Type.Union([DateOnly, Type.Null()])),
  domains: Type.Optional(
    Type.Array(DomainSchema, { uniqueItems: true, maxItems: 2 }),
  ),
  status: Type.Optional(
    Type.Union([
      Type.Literal('active'),
      Type.Literal('completed'),
      Type.Literal('archived'),
    ]),
  ),
};
const Create = Type.Required(
  Type.Pick(Type.Object(Properties), ['title', 'targetValue', 'unit']),
);
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
    targetValue: Type.Number(),
    currentValue: Type.Number(),
    unit: Type.String(),
    dueDate: Type.Union([DateOnly, Type.Null()]),
    domains: Type.Array(DomainSchema),
    status: Type.Union([
      Type.Literal('active'),
      Type.Literal('completed'),
      Type.Literal('archived'),
    ]),
    progressPercent: Type.Number({ minimum: 0, maximum: 100 }),
  },
  { additionalProperties: false },
);
const Query = Type.Object(
  {
    ...pageProperties,
    status: Type.Optional(
      Type.Union([
        Type.Literal('active'),
        Type.Literal('completed'),
        Type.Literal('archived'),
      ]),
    ),
    domain: Type.Optional(DomainSchema),
  },
  { additionalProperties: false },
);
export async function registerRoutes(
  app: FastifyInstance,
  service?: GoalsService,
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
    tags: ['Goals'],
    security,
    description:
      'Progress is manually reported; percentage is current/target capped at 100. Status is explicitly managed. Domain associations are sleep and/or education; an empty array is general.',
  };
  routes.post(
    '/goals',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Create goal',
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
    '/goals',
    {
      schema: {
        ...common,
        summary: 'List owned goals',
        querystring: Query,
        response: { ...resourceErrors, 200: pageSchema(Output) },
      },
    },
    async (request) => useService().list(bearer(request), request.query),
  );
  routes.get(
    '/goals/:id',
    {
      schema: {
        ...common,
        summary: 'Read owned goal',
        params: IdParams,
        querystring: EmptyQuery,
        response: { ...resourceErrors, 200: Output },
      },
    },
    async (request) => useService().get(bearer(request), request.params.id),
  );
  routes.patch(
    '/goals/:id',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Update owned goal',
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
    '/goals/:id',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Delete owned goal',
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
