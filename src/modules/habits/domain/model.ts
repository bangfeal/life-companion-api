import {
  ApplicationError,
  fields,
  text,
  uuid,
  timeZone,
  type PageQuery,
} from '../../../shared/domain/validation.js';

export interface HabitInput {
  title: string;
  goalId?: string | null;
  timeZone?: string;
  archived?: boolean;
}
export type HabitPatch = Partial<Omit<HabitInput, 'timeZone'>>;
export interface HabitQuery extends PageQuery {
  archived?: boolean;
  goalId?: string;
}
export interface Habit {
  id: string;
  title: string;
  goalId: string | null;
  timeZone: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
export function validateHabit(input: Partial<HabitInput>, partial = false) {
  fields(input, ['title', 'goalId', 'timeZone', 'archived'], partial);
  const result: Partial<HabitInput> = {};
  if (!partial || input.title !== undefined)
    result.title = text(input.title!, 200);
  if (input.goalId !== undefined)
    result.goalId = input.goalId === null ? null : uuid(input.goalId);
  if (input.timeZone !== undefined) {
    if (partial) throw new ApplicationError(400);
    result.timeZone = timeZone(input.timeZone);
  }
  if (input.archived !== undefined) {
    if (typeof input.archived !== 'boolean') throw new ApplicationError(400);
    result.archived = input.archived;
  }
  return result;
}

export interface HabitLogInput {
  date: string;
  completed: boolean;
}
export interface HabitLog extends HabitLogInput {
  createdAt: string;
  updatedAt: string;
}
export interface LogQuery extends PageQuery {
  fromDate?: string;
  toDate?: string;
}
