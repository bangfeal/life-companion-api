import type { Goal, GoalInput, GoalPatch, GoalQuery } from '../domain/model.js';
export interface GoalRepository {
  create(userId: string, input: GoalInput): Promise<Goal>;
  list(
    userId: string,
    query: GoalQuery & { limit: number; offset: number },
  ): Promise<Goal[]>;
  get(userId: string, id: string): Promise<Goal | undefined>;
  update(
    userId: string,
    id: string,
    patch: GoalPatch,
  ): Promise<Goal | undefined>;
  delete(userId: string, id: string): Promise<boolean>;
}
