import type { Task, TaskInput, TaskPatch, TaskQuery } from '../domain/model.js';
export interface Repository {
  create(userId: string, input: TaskInput): Promise<Task>;
  list(
    userId: string,
    query: TaskQuery & { limit: number; offset: number },
  ): Promise<Task[]>;
  get(userId: string, id: string): Promise<Task | undefined>;
  update(
    userId: string,
    id: string,
    patch: TaskPatch,
  ): Promise<Task | undefined>;
  delete(userId: string, id: string): Promise<boolean>;
}
