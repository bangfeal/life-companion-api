import type {
  SleepInput,
  SleepPatch,
  SleepSession,
  SleepQuery,
} from '../domain/model.js';
export interface SleepRepository {
  create(userId: string, input: SleepInput): Promise<SleepSession>;
  get(userId: string, id: string): Promise<SleepSession | undefined>;
  list(
    userId: string,
    query: SleepQuery & { limit: number; offset: number },
  ): Promise<SleepSession[]>;
  update(
    userId: string,
    id: string,
    patch: SleepPatch,
  ): Promise<SleepSession | undefined>;
  delete(userId: string, id: string): Promise<boolean>;
  summaryRows(
    userId: string,
    from: string,
    to: string,
  ): Promise<SleepSession[]>;
}
