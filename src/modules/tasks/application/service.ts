import type { IdentityService } from '../../identity/index.js';
import type { GoalsService } from '../../goals/index.js';
import {
  ApplicationError,
  fields,
  page,
  pagination,
  uuid,
  choice,
  instant,
} from '../../../shared/domain/validation.js';
import {
  validateTask,
  taskStatuses,
  type TaskInput,
  type TaskPatch,
  type TaskQuery,
} from '../domain/model.js';
import type { Repository } from './ports.js';
export function createService(
  repository: Repository,
  identity: Pick<IdentityService, 'authenticate'>,
  related: Pick<GoalsService, 'get'>,
) {
  return {
    async create(token: string | undefined, input: TaskInput) {
      const { userId } = await identity.authenticate(token);
      const values = validateTask(input) as TaskInput;
      if (values.goalId) await related.get(token, values.goalId);
      return repository.create(userId, values);
    },
    async list(token: string | undefined, query: TaskQuery = {}) {
      const { userId } = await identity.authenticate(token);
      fields(query, [
        'limit',
        'offset',
        'status',
        'goalId',
        'dueFrom',
        'dueTo',
      ]);
      const bounds = pagination(query);
      if (query.goalId !== undefined) uuid(query.goalId);
      if (query.status !== undefined) choice(query.status, taskStatuses);
      if (query.dueFrom !== undefined) instant(query.dueFrom);
      if (query.dueTo !== undefined) instant(query.dueTo);
      if (
        query.dueFrom &&
        query.dueTo &&
        Date.parse(query.dueFrom) >= Date.parse(query.dueTo)
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
    async update(token: string | undefined, id: string, patch: TaskPatch) {
      const { userId } = await identity.authenticate(token);
      uuid(id);
      const values = validateTask(patch, true);
      if (values.goalId) await related.get(token, values.goalId);
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
export type TasksService = ReturnType<typeof createService>;
