export class ApplicationError extends Error {
  constructor(public readonly statusCode: 400 | 404 | 409 | 503) {
    super('Application operation failed');
  }
}
export const domains = ['sleep', 'education'] as const;
export type Domain = (typeof domains)[number];
export function fields(input: object, allowed: string[], partial = false) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    (partial && !Object.keys(input).length)
  )
    throw new ApplicationError(400);
}
export function text(value: string, max: number) {
  if (typeof value !== 'string' || !value.trim() || [...value].length > max)
    throw new ApplicationError(400);
  return value.trim();
}
export function uuid(value: string) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new ApplicationError(400);
  return value;
}
export function choice<T extends string>(value: T, choices: readonly T[]): T {
  if (!choices.includes(value)) throw new ApplicationError(400);
  return value;
}
export function amount(value: number, positive = false) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1e12 ||
    (positive && value === 0)
  )
    throw new ApplicationError(400);
  return value;
}
export function date(value: string) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith('0000') ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new ApplicationError(400);
  return value;
}
export function instant(value: string) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/i.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new ApplicationError(400);
  date(value.slice(0, 10));
  if (
    Number(value.slice(11, 13)) > 23 ||
    Number(value.slice(14, 16)) > 59 ||
    Number(value.slice(17, 19)) > 59
  )
    throw new ApplicationError(400);
  const normalized = new Date(value).toISOString();
  if (!/^\d{4}-/.test(normalized) || normalized.startsWith('0000'))
    throw new ApplicationError(400);
  return normalized;
}
export function timeZone(value: string) {
  try {
    if (
      typeof value !== 'string' ||
      value.length > 100 ||
      (value !== 'UTC' && !value.includes('/'))
    )
      throw new Error();
    new Intl.DateTimeFormat('en', { timeZone: value });
    return value;
  } catch {
    throw new ApplicationError(400);
  }
}
export interface PageQuery {
  limit?: number;
  offset?: number;
}
export function pagination(query: PageQuery) {
  const limit = query.limit ?? 20,
    offset = query.offset ?? 0;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 10000
  )
    throw new ApplicationError(400);
  return { limit, offset };
}
export function page<T>(rows: T[], limit: number, offset: number) {
  return {
    items: rows.slice(0, limit),
    limit,
    offset,
    nextOffset:
      rows.length > limit && offset + limit <= 10000 ? offset + limit : null,
  };
}
