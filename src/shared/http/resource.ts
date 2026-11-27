import { Type, type TSchema } from 'typebox';
import type { FastifyRequest } from 'fastify';
import { ProblemSchema } from '../problem.js';
export const Id = Type.String({ format: 'uuid' });
export const Instant = Type.String({ format: 'date-time' });
export const DateOnly = Type.String({ format: 'date' });
export const DomainSchema = Type.Union([
  Type.Literal('sleep'),
  Type.Literal('education'),
]);
export const pageProperties = {
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  offset: Type.Optional(
    Type.Integer({ minimum: 0, maximum: 10000, default: 0 }),
  ),
};
export const IdParams = Type.Object(
  { id: Id },
  { additionalProperties: false },
);
export const EmptyQuery = Type.Object({}, { additionalProperties: false });
export const baseProperties = {
  id: Id,
  createdAt: Instant,
  updatedAt: Instant,
};
export const security = [{ bearerAuth: [] }];
export function problem(description: string) {
  return {
    description,
    content: { 'application/problem+json': { schema: ProblemSchema } },
  };
}
export const resourceErrors = {
  400: problem('Invalid input'),
  401: problem('Missing, expired, invalid or revoked session'),
  404: problem('Resource or related resource not found for this user'),
  409: problem('Related resource changed; refresh and retry'),
  413: problem('Request body too large'),
  415: problem('Unsupported media type'),
  429: problem('Rate limit exceeded'),
  500: problem('Unexpected server failure'),
  503: problem('Service not configured'),
};
export function pageSchema<T extends TSchema>(item: T) {
  return Type.Object(
    {
      items: Type.Array(item),
      limit: Type.Integer(),
      offset: Type.Integer(),
      nextOffset: Type.Union([Type.Integer(), Type.Null()]),
    },
    { additionalProperties: false },
  );
}
export function bearer(request: FastifyRequest) {
  return request.headers.authorization?.match(
    /^Bearer ([A-Za-z0-9_-]{43})$/i,
  )?.[1];
}
