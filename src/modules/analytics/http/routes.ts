import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from 'typebox';
import type { ReviewService } from '../application/service.js';
import { SleepSummarySchema } from '../../sleep/index.js';
import { EducationSummarySchema } from '../../education/index.js';
import { ApplicationError } from '../../../shared/domain/validation.js';
import {
  bearer,
  DateOnly,
  resourceErrors,
  security,
} from '../../../shared/http/resource.js';
import {
  WindowSchema,
  windowProperties,
  NullableNumber,
} from '../../../shared/http/time.js';
const Output = Type.Object(
  {
    ...windowProperties,
    sleep: SleepSummarySchema,
    education: EducationSummarySchema,
    daily: Type.Array(
      Type.Object(
        {
          date: DateOnly,
          sleepMinutes: NullableNumber,
          studyMinutes: NullableNumber,
          sleepSessionCount: Type.Integer(),
          studySessionCount: Type.Integer(),
        },
        { additionalProperties: false },
      ),
    ),
    interpretation: Type.String(),
  },
  { additionalProperties: false },
);
export async function registerRoutes(
  app: FastifyInstance,
  service?: ReviewService,
) {
  const routes = app.withTypeProvider<TypeBoxTypeProvider>();
  routes.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
  });
  routes.get(
    '/analytics/sleep-study',
    {
      schema: {
        tags: ['Analytics'],
        security,
        summary: 'Review recorded sleep and study progress together',
        description:
          'Combines public domain summaries; missing daily data stays null, not an assertion of zero actual activity. No correlation or causal inference is calculated.',
        querystring: WindowSchema,
        response: { ...resourceErrors, 200: Output },
      },
    },
    async (request) => {
      if (!service) throw new ApplicationError(503);
      return service.sleepStudy(bearer(request), request.query);
    },
  );
}
