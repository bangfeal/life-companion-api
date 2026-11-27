import {
  ApplicationError,
  fields,
  text,
  uuid,
  instant,
  timeZone,
  type PageQuery,
} from '../../../shared/domain/validation.js';

export interface EventInput {
  title: string;
  description?: string | null;
  taskId?: string | null;
  startsAt: string;
  endsAt: string;
  timeZone: string;
}
export type EventPatch = Partial<EventInput>;
export interface EventQuery extends PageQuery {
  from?: string;
  to?: string;
  taskId?: string;
}
export interface Event {
  id: string;
  title: string;
  description: string | null;
  taskId: string | null;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  createdAt: string;
  updatedAt: string;
}
export function validateEvent(input: EventPatch, partial = false) {
  fields(
    input,
    ['title', 'description', 'taskId', 'startsAt', 'endsAt', 'timeZone'],
    partial,
  );
  const result: EventPatch = {};
  if (!partial || input.title !== undefined)
    result.title = text(input.title!, 200);
  if (input.description !== undefined)
    result.description =
      input.description === null ? null : text(input.description, 2000);
  if (input.taskId !== undefined)
    result.taskId = input.taskId === null ? null : uuid(input.taskId);
  if (!partial || input.startsAt !== undefined)
    result.startsAt = instant(input.startsAt!);
  if (!partial || input.endsAt !== undefined)
    result.endsAt = instant(input.endsAt!);
  if (!partial || input.timeZone !== undefined)
    result.timeZone = timeZone(input.timeZone!);
  if (
    result.startsAt &&
    result.endsAt &&
    Date.parse(result.startsAt) >= Date.parse(result.endsAt)
  )
    throw new ApplicationError(400);
  return result;
}
