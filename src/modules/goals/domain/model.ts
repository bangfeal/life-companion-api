import {
  ApplicationError,
  amount,
  choice,
  date,
  domains,
  fields,
  text,
  type Domain,
  type PageQuery,
} from '../../../shared/domain/validation.js';
export const goalStatuses = ['active', 'completed', 'archived'] as const;
export interface GoalInput {
  title: string;
  description?: string | null;
  targetValue: number;
  currentValue?: number;
  unit: string;
  dueDate?: string | null;
  domains?: Domain[];
  status?: (typeof goalStatuses)[number];
}
export type GoalPatch = Partial<GoalInput>;
export interface GoalQuery extends PageQuery {
  status?: (typeof goalStatuses)[number];
  domain?: Domain;
}
export interface Goal {
  id: string;
  title: string;
  description: string | null;
  targetValue: number;
  currentValue: number;
  unit: string;
  dueDate: string | null;
  status: (typeof goalStatuses)[number];
  domains: Domain[];
  createdAt: string;
  updatedAt: string;
}
export function validateGoal(input: GoalPatch, partial = false) {
  fields(
    input,
    [
      'title',
      'description',
      'targetValue',
      'currentValue',
      'unit',
      'dueDate',
      'domains',
      'status',
    ],
    partial,
  );
  const result: GoalPatch = {};
  if (!partial || input.title !== undefined)
    result.title = text(input.title!, 200);
  if (input.description !== undefined)
    result.description =
      input.description === null ? null : text(input.description, 2000);
  if (!partial || input.targetValue !== undefined)
    result.targetValue = amount(input.targetValue!, true);
  if (input.currentValue !== undefined)
    result.currentValue = amount(input.currentValue);
  if (!partial || input.unit !== undefined) result.unit = text(input.unit!, 50);
  if (input.dueDate !== undefined)
    result.dueDate = input.dueDate === null ? null : date(input.dueDate);
  if (input.status !== undefined)
    result.status = choice(input.status, goalStatuses);
  if (input.domains !== undefined) {
    if (
      !Array.isArray(input.domains) ||
      input.domains.length > domains.length ||
      new Set(input.domains).size !== input.domains.length
    )
      throw new ApplicationError(400);
    result.domains = input.domains.map((domain) => choice(domain, domains));
  }
  return result;
}
export function goalProgress(current: number, target: number) {
  return Math.min(
    100,
    Math.round((amount(current) / amount(target, true)) * 10000) / 100,
  );
}
