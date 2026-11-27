import type { IdentityService } from '../../identity/index.js';
import type { GoalsService } from '../../goals/index.js';
import {
  ApplicationError,
  fields,
  page,
  pagination,
  uuid,
  date,
} from '../../../shared/domain/validation.js';
import {
  validateHabit,
  type HabitInput,
  type HabitPatch,
  type HabitLogInput,
  type LogQuery,
  type HabitQuery,
} from '../domain/model.js';
import type { Repository } from './ports.js';
export function createService(
  repository: Repository,
  identity: Pick<IdentityService, 'authenticate'>,
  related: Pick<GoalsService, 'get'>,
) {
  return {
    async log(token: string | undefined, id: string, input: HabitLogInput) {
      const { userId } = await identity.authenticate(token);
      uuid(id);
      fields(input, ['date', 'completed']);
      date(input.date);
      if (typeof input.completed !== 'boolean') throw new ApplicationError(400);
      const result = await repository.log(userId, id, input);
      if (!result) throw new ApplicationError(404);
      return result;
    },
    async logs(token: string | undefined, id: string, query: LogQuery = {}) {
      const { userId } = await identity.authenticate(token);
      uuid(id);
      fields(query, ['limit', 'offset', 'fromDate', 'toDate']);
      const bounds = pagination(query);
      if (query.fromDate !== undefined) date(query.fromDate);
      if (query.toDate !== undefined) date(query.toDate);
      if (query.fromDate && query.toDate && query.fromDate > query.toDate)
        throw new ApplicationError(400);
      const rows = await repository.logs(userId, id, { ...query, ...bounds });
      if (!rows) throw new ApplicationError(404);
      return page(rows, bounds.limit, bounds.offset);
    },
    async create(token: string | undefined, input: HabitInput) {
      const { userId } = await identity.authenticate(token);
      const values = validateHabit(input) as HabitInput;
      if (values.goalId) await related.get(token, values.goalId);
      return repository.create(userId, values);
    },
    async list(token: string | undefined, query: HabitQuery = {}) {
      const { userId } = await identity.authenticate(token);
      fields(query, ['limit', 'offset', 'archived', 'goalId']);
      const bounds = pagination(query);
      if (query.goalId !== undefined) uuid(query.goalId);
      if (query.archived !== undefined && typeof query.archived !== 'boolean')
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
    async update(token: string | undefined, id: string, patch: HabitPatch) {
      const { userId } = await identity.authenticate(token);
      uuid(id);
      const values = validateHabit(patch, true);
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
export type HabitsService = ReturnType<typeof createService>;
