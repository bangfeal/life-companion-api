import type { IdentityService } from '../../identity/index.js';
import {
  ApplicationError,
  choice,
  fields,
  instant,
  page,
  pagination,
  uuid,
} from '../../../shared/domain/validation.js';
import {
  boundedSummary,
  windowQuery,
  type WindowQuery,
} from '../../../shared/domain/time.js';
import {
  validateSleep,
  sleepMetrics,
  sleepSummary,
  type SleepInput,
  type SleepPatch,
  type SleepQuery,
} from '../domain/model.js';
import type { SleepRepository } from './ports.js';
export function createService(
  repository: SleepRepository,
  identity: Pick<IdentityService, 'authenticate'>,
) {
  return {
    async create(token: string | undefined, input: SleepInput) {
      const { userId } = await identity.authenticate(token);
      return sleepMetrics(
        await repository.create(userId, validateSleep(input) as SleepInput),
      );
    },
    async get(token: string | undefined, id: string) {
      const { userId } = await identity.authenticate(token);
      const row = await repository.get(userId, uuid(id));
      if (!row) throw new ApplicationError(404);
      return sleepMetrics(row);
    },
    async list(token: string | undefined, query: SleepQuery = {}) {
      const { userId } = await identity.authenticate(token);
      fields(query, ['limit', 'offset', 'from', 'to', 'kind']);
      const bounds = pagination(query);
      if (query.from !== undefined) instant(query.from);
      if (query.to !== undefined) instant(query.to);
      if (query.kind !== undefined) choice(query.kind, ['main', 'nap']);
      if (
        query.from &&
        query.to &&
        Date.parse(query.from) >= Date.parse(query.to)
      )
        throw new ApplicationError(400);
      return page(
        (await repository.list(userId, { ...query, ...bounds })).map(
          sleepMetrics,
        ),
        bounds.limit,
        bounds.offset,
      );
    },
    async update(token: string | undefined, id: string, patch: SleepPatch) {
      const { userId } = await identity.authenticate(token);
      const row = await repository.update(
        userId,
        uuid(id),
        validateSleep(patch, true),
      );
      if (!row) throw new ApplicationError(404);
      return sleepMetrics(row);
    },
    async delete(token: string | undefined, id: string) {
      const { userId } = await identity.authenticate(token);
      if (!(await repository.delete(userId, uuid(id))))
        throw new ApplicationError(404);
    },
    async summary(token: string | undefined, query: WindowQuery) {
      const { userId } = await identity.authenticate(token);
      const window = windowQuery(query);
      return {
        ...window,
        ...sleepSummary(
          boundedSummary(
            await repository.summaryRows(userId, window.from, window.to),
          ),
          window.timeZone,
        ),
      };
    },
  };
}
export type SleepService = ReturnType<typeof createService>;
