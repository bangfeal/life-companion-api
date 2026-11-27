import type { IdentityService } from '../../identity/index.js';
import type { TasksService } from '../../tasks/index.js';
import {
  ApplicationError,
  fields,
  page,
  pagination,
  uuid,
  instant,
} from '../../../shared/domain/validation.js';
import {
  validateEvent,
  type EventInput,
  type EventPatch,
  type EventQuery,
} from '../domain/model.js';
import type { Repository } from './ports.js';
export function createService(
  repository: Repository,
  identity: Pick<IdentityService, 'authenticate'>,
  related: Pick<TasksService, 'get'>,
) {
  return {
    async create(token: string | undefined, input: EventInput) {
      const { userId } = await identity.authenticate(token);
      const values = validateEvent(input) as EventInput;
      if (values.taskId) await related.get(token, values.taskId);
      return repository.create(userId, values);
    },
    async list(token: string | undefined, query: EventQuery = {}) {
      const { userId } = await identity.authenticate(token);
      fields(query, ['limit', 'offset', 'taskId', 'from', 'to']);
      const bounds = pagination(query);
      if (query.taskId !== undefined) uuid(query.taskId);
      if (query.from !== undefined) instant(query.from);
      if (query.to !== undefined) instant(query.to);
      if (
        query.from &&
        query.to &&
        Date.parse(query.from) >= Date.parse(query.to)
      )
        throw new ApplicationError(400);
      return page(
        await repository.list(userId, { ...query, ...bounds }),
        bounds.limit,
        bounds.offset,
      );
    },
    async get(token: string | undefined, id: string) {
      const { userId } = await identity.authenticate(token);
      const row = await repository.get(userId, uuid(id));
      if (!row) throw new ApplicationError(404);
      return row;
    },
    async update(token: string | undefined, id: string, patch: EventPatch) {
      const { userId } = await identity.authenticate(token);
      uuid(id);
      const values = validateEvent(patch, true);
      if (values.taskId) await related.get(token, values.taskId);
      const row = await repository.update(userId, id, values);
      if (!row) throw new ApplicationError(404);
      return row;
    },
    async delete(token: string | undefined, id: string) {
      const { userId } = await identity.authenticate(token);
      if (!(await repository.delete(userId, uuid(id))))
        throw new ApplicationError(404);
    },
  };
}
export type SchedulingService = ReturnType<typeof createService>;
