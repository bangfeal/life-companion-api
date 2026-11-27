import type { IdentityService } from '../../identity/index.js';
import type { TasksService } from '../../tasks/index.js';
import type { SchedulingService } from '../../scheduling/index.js';
import {
  ApplicationError,
  choice,
  fields,
  instant,
  page,
  pagination,
  text,
  timeZone,
  uuid,
} from '../../../shared/domain/validation.js';
import {
  boundedSummary,
  windowQuery,
  type WindowQuery,
} from '../../../shared/domain/time.js';
import {
  validateStudy,
  validateExam,
  studyMetrics,
  examMetrics,
  educationSummary,
  type StudyInput,
  type StudyPatch,
  type StudyQuery,
  type ExamInput,
  type ExamPatch,
  type ExamQuery,
} from '../domain/model.js';
import type { EducationRepository } from './ports.js';
export interface StudyPlanInput {
  subject: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
}
function bounds(query: { from?: string; to?: string }) {
  if (query.from !== undefined) instant(query.from);
  if (query.to !== undefined) instant(query.to);
  if (query.from && query.to && Date.parse(query.from) >= Date.parse(query.to))
    throw new ApplicationError(400);
}
export function createService(
  repository: EducationRepository,
  identity: Pick<IdentityService, 'authenticate'>,
  tasks: Pick<TasksService, 'get'>,
  scheduling: Pick<SchedulingService, 'create'>,
) {
  async function links(
    token: string | undefined,
    userId: string,
    input: StudyPatch,
  ) {
    if (input.taskId) await tasks.get(token, input.taskId);
    if (
      input.examinationId &&
      !(await repository.getExam(userId, input.examinationId))
    )
      throw new ApplicationError(404);
  }
  return {
    async createSession(token: string | undefined, input: StudyInput) {
      const { userId } = await identity.authenticate(token);
      const values = validateStudy(input) as StudyInput;
      await links(token, userId, values);
      return studyMetrics(await repository.createSession(userId, values));
    },
    async getSession(token: string | undefined, id: string) {
      const { userId } = await identity.authenticate(token);
      const row = await repository.getSession(userId, uuid(id));
      if (!row) throw new ApplicationError(404);
      return studyMetrics(row);
    },
    async listSessions(token: string | undefined, query: StudyQuery = {}) {
      const { userId } = await identity.authenticate(token);
      fields(query, [
        'limit',
        'offset',
        'from',
        'to',
        'subject',
        'taskId',
        'examinationId',
      ]);
      const limits = pagination(query);
      bounds(query);
      if (query.subject !== undefined)
        query = { ...query, subject: text(query.subject, 100) };
      if (query.taskId !== undefined) uuid(query.taskId);
      if (query.examinationId !== undefined) uuid(query.examinationId);
      return page(
        (await repository.listSessions(userId, { ...query, ...limits })).map(
          studyMetrics,
        ),
        limits.limit,
        limits.offset,
      );
    },
    async updateSession(
      token: string | undefined,
      id: string,
      patch: StudyPatch,
    ) {
      const { userId } = await identity.authenticate(token);
      uuid(id);
      const values = validateStudy(patch, true);
      await links(token, userId, values);
      const row = await repository.updateSession(userId, id, values);
      if (!row) throw new ApplicationError(404);
      return studyMetrics(row);
    },
    async deleteSession(token: string | undefined, id: string) {
      const { userId } = await identity.authenticate(token);
      if (!(await repository.deleteSession(userId, uuid(id))))
        throw new ApplicationError(404);
    },
    async createExam(token: string | undefined, input: ExamInput) {
      const { userId } = await identity.authenticate(token);
      return examMetrics(
        await repository.createExam(userId, validateExam(input) as ExamInput),
      );
    },
    async getExam(token: string | undefined, id: string) {
      const { userId } = await identity.authenticate(token);
      const row = await repository.getExam(userId, uuid(id));
      if (!row) throw new ApplicationError(404);
      return examMetrics(row);
    },
    async listExams(token: string | undefined, query: ExamQuery = {}) {
      const { userId } = await identity.authenticate(token);
      fields(query, ['limit', 'offset', 'from', 'to', 'subject', 'status']);
      const limits = pagination(query);
      bounds(query);
      if (query.subject !== undefined)
        query = { ...query, subject: text(query.subject, 100) };
      if (query.status !== undefined)
        choice(query.status, ['scheduled', 'completed', 'canceled']);
      return page(
        (await repository.listExams(userId, { ...query, ...limits })).map(
          examMetrics,
        ),
        limits.limit,
        limits.offset,
      );
    },
    async updateExam(token: string | undefined, id: string, patch: ExamPatch) {
      const { userId } = await identity.authenticate(token);
      const row = await repository.updateExam(
        userId,
        uuid(id),
        validateExam(patch, true),
      );
      if (!row) throw new ApplicationError(404);
      return examMetrics(row);
    },
    async deleteExam(token: string | undefined, id: string) {
      const { userId } = await identity.authenticate(token);
      if (!(await repository.deleteExam(userId, uuid(id))))
        throw new ApplicationError(404);
    },
    async summary(token: string | undefined, query: WindowQuery) {
      const { userId } = await identity.authenticate(token);
      const window = windowQuery(query);
      const rows = await repository.summaryRows(userId, window.from, window.to);
      return {
        ...window,
        ...educationSummary(
          boundedSummary(rows.sessions),
          boundedSummary(rows.examinations),
          window.timeZone,
        ),
      };
    },
    async scheduleTask(
      token: string | undefined,
      id: string,
      input: StudyPlanInput,
    ) {
      await identity.authenticate(token);
      uuid(id);
      fields(input, ['subject', 'startsAt', 'endsAt', 'timeZone']);
      const subject = text(input.subject, 100),
        start = instant(input.startsAt),
        end = instant(input.endsAt),
        zone = timeZone(input.timeZone);
      if (Date.parse(end) <= Date.parse(start)) throw new ApplicationError(400);
      const task = await tasks.get(token, id);
      if (task.status !== 'todo') throw new ApplicationError(409);
      return scheduling.create(token, {
        title: `Study: ${subject}`,
        description: task.title,
        taskId: id,
        startsAt: start,
        endsAt: end,
        timeZone: zone,
      });
    },
  };
}
export type EducationService = ReturnType<typeof createService>;
