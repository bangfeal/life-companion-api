import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from 'typebox';
import type { EducationService } from '../application/service.js';
import { ApplicationError } from '../../../shared/domain/validation.js';
import {
  bearer,
  EmptyQuery,
  IdParams,
  Id,
  Instant,
  pageProperties,
  pageSchema,
  resourceErrors,
  security,
} from '../../../shared/http/resource.js';
import { WindowSchema } from '../../../shared/http/time.js';
import {
  StudyInputSchema,
  StudyPatchSchema,
  StudySchema,
  ExamInputSchema,
  ExamPatchSchema,
  ExamSchema,
  EducationSummarySchema,
  StudyPlanSchema,
} from './contracts.js';
import { EventSchema } from '../../scheduling/index.js';
export async function registerRoutes(
  app: FastifyInstance,
  service?: EducationService,
) {
  const routes = app.withTypeProvider<TypeBoxTypeProvider>();
  function useService() {
    if (!service) throw new ApplicationError(503);
    return service;
  }
  routes.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
  });
  const common = { tags: ['Education'], security };

  const StudyQuery = Type.Object(
    {
      ...pageProperties,
      from: Type.Optional(Instant),
      to: Type.Optional(Instant),
      subject: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
      taskId: Type.Optional(Id),
      examinationId: Type.Optional(Id),
    },
    { additionalProperties: false },
  );
  routes.post(
    '/study/sessions',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Create study record',
        description:
          'Completed reported study intervals, up to 24 hours. Break minutes must leave positive focused time. History uses overlap filters [from,to).',
        body: StudyInputSchema,
        querystring: EmptyQuery,
        response: { ...resourceErrors, 201: StudySchema },
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(await useService().createSession(bearer(request), request.body)),
  );
  routes.get(
    '/study/sessions',
    {
      schema: {
        ...common,
        summary: 'List owned study records',
        description:
          'Completed reported study intervals, up to 24 hours. Break minutes must leave positive focused time. History uses overlap filters [from,to).',
        querystring: StudyQuery,
        response: { ...resourceErrors, 200: pageSchema(StudySchema) },
      },
    },
    async (request) =>
      useService().listSessions(bearer(request), request.query),
  );
  routes.get(
    '/study/sessions/:id',
    {
      schema: {
        ...common,
        summary: 'Read owned study record',
        params: IdParams,
        querystring: EmptyQuery,
        response: { ...resourceErrors, 200: StudySchema },
      },
    },
    async (request) =>
      useService().getSession(bearer(request), request.params.id),
  );
  routes.patch(
    '/study/sessions/:id',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Edit owned study record',
        params: IdParams,
        querystring: EmptyQuery,
        body: StudyPatchSchema,
        response: { ...resourceErrors, 200: StudySchema },
      },
    },
    async (request) =>
      useService().updateSession(
        bearer(request),
        request.params.id,
        request.body,
      ),
  );
  routes.delete(
    '/study/sessions/:id',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Delete owned study record',
        params: IdParams,
        querystring: EmptyQuery,
        response: {
          ...resourceErrors,
          204: Type.Null({ description: 'Deleted; empty body' }),
        },
      },
    },
    async (request, reply) => {
      await useService().deleteSession(bearer(request), request.params.id);
      return reply.code(204).send(null);
    },
  );

  const ExamQuery = Type.Object(
    {
      ...pageProperties,
      from: Type.Optional(Instant),
      to: Type.Optional(Instant),
      subject: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
      status: Type.Optional(
        Type.Union([
          Type.Literal('scheduled'),
          Type.Literal('completed'),
          Type.Literal('canceled'),
        ]),
      ),
    },
    { additionalProperties: false },
  );
  routes.post(
    '/examinations',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Create exam record',
        description:
          'Examination dates use [from,to). Scores require a completed exam and a positive maxScore. Unknown/other-owner exams return 404.',
        body: ExamInputSchema,
        querystring: EmptyQuery,
        response: { ...resourceErrors, 201: ExamSchema },
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(await useService().createExam(bearer(request), request.body)),
  );
  routes.get(
    '/examinations',
    {
      schema: {
        ...common,
        summary: 'List owned exam records',
        description:
          'Examination dates use [from,to). Scores require a completed exam and a positive maxScore. Unknown/other-owner exams return 404.',
        querystring: ExamQuery,
        response: { ...resourceErrors, 200: pageSchema(ExamSchema) },
      },
    },
    async (request) => useService().listExams(bearer(request), request.query),
  );
  routes.get(
    '/examinations/:id',
    {
      schema: {
        ...common,
        summary: 'Read owned exam record',
        params: IdParams,
        querystring: EmptyQuery,
        response: { ...resourceErrors, 200: ExamSchema },
      },
    },
    async (request) => useService().getExam(bearer(request), request.params.id),
  );
  routes.patch(
    '/examinations/:id',
    {
      bodyLimit: 16384,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Edit owned exam record',
        params: IdParams,
        querystring: EmptyQuery,
        body: ExamPatchSchema,
        response: { ...resourceErrors, 200: ExamSchema },
      },
    },
    async (request) =>
      useService().updateExam(bearer(request), request.params.id, request.body),
  );
  routes.delete(
    '/examinations/:id',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Delete owned exam record',
        params: IdParams,
        querystring: EmptyQuery,
        response: {
          ...resourceErrors,
          204: Type.Null({ description: 'Deleted; empty body' }),
        },
      },
    },
    async (request, reply) => {
      await useService().deleteExam(bearer(request), request.params.id);
      return reply.code(204).send(null);
    },
  );

  routes.get(
    '/study/summary',
    {
      schema: {
        ...common,
        summary: 'Descriptive education summary',
        description:
          'Includes complete sessions ending in [from,to), not clipped history overlaps. Assigns full duration to the end local date in the requested timezone. Maximum 93 elapsed days and 10,000 source rows; no recommendations or causal claims.',
        querystring: WindowSchema,
        response: { ...resourceErrors, 200: EducationSummarySchema },
      },
    },
    async (request) => useService().summary(bearer(request), request.query),
  );

  routes.post(
    '/study/tasks/:id/schedule',
    {
      bodyLimit: 4096,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        ...common,
        summary: 'Schedule an owned todo task as a study event',
        description:
          'Uses public tasks and scheduling services. Does not create a recorded study session or change task status. Creation retries may create another event.',
        params: IdParams,
        querystring: EmptyQuery,
        body: StudyPlanSchema,
        response: { ...resourceErrors, 201: EventSchema },
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(
          await useService().scheduleTask(
            bearer(request),
            request.params.id,
            request.body,
          ),
        ),
  );
}
