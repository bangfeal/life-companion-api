import type {
  Habit,
  HabitInput,
  HabitPatch,
  HabitQuery,
  HabitLog,
  HabitLogInput,
  LogQuery,
} from '../domain/model.js';
export interface Repository {
  log(
    userId: string,
    id: string,
    input: HabitLogInput,
  ): Promise<HabitLog | undefined>;
  logs(
    userId: string,
    id: string,
    query: LogQuery & { limit: number; offset: number },
  ): Promise<HabitLog[] | undefined>;
  create(userId: string, input: HabitInput): Promise<Habit>;
  list(
    userId: string,
    query: HabitQuery & { limit: number; offset: number },
  ): Promise<Habit[]>;
  get(userId: string, id: string): Promise<Habit | undefined>;
  update(
    userId: string,
    id: string,
    patch: HabitPatch,
  ): Promise<Habit | undefined>;
  delete(userId: string, id: string): Promise<boolean>;
}
