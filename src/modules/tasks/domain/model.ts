import {
  fields,
  text,
  uuid,
  instant,
  choice,
  type PageQuery,
} from '../../../shared/domain/validation.js';
export const taskStatuses = ['todo', 'done', 'canceled'] as const;
export interface TaskInput {
  title: string;
  description?: string | null;
  goalId?: string | null;
  dueAt?: string | null;
  status?: (typeof taskStatuses)[number];
}
export type TaskPatch = Partial<TaskInput>;
export interface TaskQuery extends PageQuery {
  status?: (typeof taskStatuses)[number];
  goalId?: string;
  dueFrom?: string;
  dueTo?: string;
}
export interface Task {
  id: string;
  title: string;
  description: string | null;
  goalId: string | null;
  dueAt: string | null;
  status: (typeof taskStatuses)[number];
  createdAt: string;
  updatedAt: string;
}
export function validateTask(input: TaskPatch, partial = false) {
  fields(input, ['title', 'description', 'goalId', 'dueAt', 'status'], partial);
  const result: TaskPatch = {};
  if (!partial || input.title !== undefined)
    result.title = text(input.title!, 200);
  if (input.description !== undefined)
    result.description =
      input.description === null ? null : text(input.description, 2000);
  if (input.goalId !== undefined)
    result.goalId = input.goalId === null ? null : uuid(input.goalId);
  if (input.dueAt !== undefined)
    result.dueAt = input.dueAt === null ? null : instant(input.dueAt);
  if (input.status !== undefined)
    result.status = choice(input.status, taskStatuses);
  return result;
}
