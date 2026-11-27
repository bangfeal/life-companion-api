import type {
  StudyInput,
  StudyPatch,
  StudyQuery,
  StudySession,
  ExamInput,
  ExamPatch,
  ExamQuery,
  Examination,
} from '../domain/model.js';
export interface EducationRepository {
  createSession(userId: string, input: StudyInput): Promise<StudySession>;
  getSession(userId: string, id: string): Promise<StudySession | undefined>;
  listSessions(
    userId: string,
    query: StudyQuery & { limit: number; offset: number },
  ): Promise<StudySession[]>;
  updateSession(
    userId: string,
    id: string,
    patch: StudyPatch,
  ): Promise<StudySession | undefined>;
  deleteSession(userId: string, id: string): Promise<boolean>;
  createExam(userId: string, input: ExamInput): Promise<Examination>;
  getExam(userId: string, id: string): Promise<Examination | undefined>;
  listExams(
    userId: string,
    query: ExamQuery & { limit: number; offset: number },
  ): Promise<Examination[]>;
  updateExam(
    userId: string,
    id: string,
    patch: ExamPatch,
  ): Promise<Examination | undefined>;
  deleteExam(userId: string, id: string): Promise<boolean>;
  summaryRows(
    userId: string,
    from: string,
    to: string,
  ): Promise<{ sessions: StudySession[]; examinations: Examination[] }>;
}
