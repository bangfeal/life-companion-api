import type { IdentityService } from '../../identity/index.js';
import {
  ApplicationError,
  choice,
  domains,
  fields,
  page,
  pagination,
  uuid,
} from '../../../shared/domain/validation.js';
import {
  goalProgress,
  goalStatuses,
  validateGoal,
  type Goal,
  type GoalInput,
  type GoalPatch,
  type GoalQuery,
} from '../domain/model.js';
import type { GoalRepository } from './ports.js';
export function createGoalsService(
  repository: GoalRepository,
  identity: Pick<IdentityService, 'authenticate'>,
) {
  const dto = (goal: Goal) => ({
    ...goal,
    progressPercent: goalProgress(goal.currentValue, goal.targetValue),
  });
  return {
    async create(token: string | undefined, input: GoalInput) {
      const { userId } = await identity.authenticate(token);
      return dto(
        await repository.create(userId, validateGoal(input) as GoalInput),
      );
    },
    async list(token: string | undefined, query: GoalQuery = {}) {
      const { userId } = await identity.authenticate(token);
      fields(query, ['limit', 'offset', 'status', 'domain']);
      const bounds = pagination(query);
      if (query.status !== undefined) choice(query.status, goalStatuses);
      if (query.domain !== undefined) choice(query.domain, domains);
      return page(
        (await repository.list(userId, { ...query, ...bounds })).map(dto),
        bounds.limit,
        bounds.offset,
      );
    },
    async get(token: string | undefined, id: string) {
      const { userId } = await identity.authenticate(token);
      const goal = await repository.get(userId, uuid(id));
      if (!goal) throw new ApplicationError(404);
      return dto(goal);
    },
    async update(token: string | undefined, id: string, patch: GoalPatch) {
      const { userId } = await identity.authenticate(token);
      const goal = await repository.update(
        userId,
        uuid(id),
        validateGoal(patch, true),
      );
      if (!goal) throw new ApplicationError(404);
      return dto(goal);
    },
    async delete(token: string | undefined, id: string) {
      const { userId } = await identity.authenticate(token);
      if (!(await repository.delete(userId, uuid(id))))
        throw new ApplicationError(404);
    },
  };
}
export type GoalsService = ReturnType<typeof createGoalsService>;
