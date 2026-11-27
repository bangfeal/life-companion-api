import { Type } from 'typebox';
import { Id, Instant, baseProperties } from '../../../shared/http/resource.js';
import {
  Zone,
  NullableNumber,
  windowProperties,
  dailyStudy,
} from '../../../shared/http/time.js';
const NullableId = Type.Union([Id, Type.Null()]);
const Notes = Type.Union([
  Type.String({ minLength: 1, maxLength: 1000 }),
  Type.Null(),
]);
const Activity = Type.Union([
  Type.Literal('reading'),
  Type.Literal('practice'),
  Type.Literal('review'),
  Type.Literal('lecture'),
]);
const Status = Type.Union([
  Type.Literal('scheduled'),
  Type.Literal('completed'),
  Type.Literal('canceled'),
]);
export const StudyProperties = {
  subject: Type.String({ minLength: 1, maxLength: 100 }),
  activity: Type.Optional(Activity),
  startsAt: Instant,
  endsAt: Instant,
  timeZone: Zone,
  breakMinutes: Type.Optional(Type.Integer({ minimum: 0, maximum: 1440 })),
  taskId: Type.Optional(NullableId),
  examinationId: Type.Optional(NullableId),
  notes: Type.Optional(Notes),
};
export const StudyInputSchema = Type.Object(StudyProperties, {
  additionalProperties: false,
});
export const StudyPatchSchema = Type.Partial(
  Type.Object(StudyProperties, {
    additionalProperties: false,
    minProperties: 1,
  }),
);
export const StudySchema = Type.Object(
  {
    ...baseProperties,
    subject: Type.String(),
    activity: Activity,
    startsAt: Instant,
    endsAt: Instant,
    timeZone: Zone,
    breakMinutes: Type.Integer(),
    taskId: NullableId,
    examinationId: NullableId,
    notes: Notes,
    provenance: Type.Literal('manual'),
    durationMinutes: Type.Number(),
    focusedMinutes: Type.Number(),
  },
  { additionalProperties: false },
);
export const ExamProperties = {
  title: Type.String({ minLength: 1, maxLength: 200 }),
  subject: Type.String({ minLength: 1, maxLength: 100 }),
  scheduledAt: Instant,
  timeZone: Zone,
  durationMinutes: Type.Optional(
    Type.Union([Type.Integer({ minimum: 1, maximum: 1440 }), Type.Null()]),
  ),
  status: Type.Optional(Status),
  score: Type.Optional(
    Type.Union([Type.Number({ minimum: 0, maximum: 1e12 }), Type.Null()]),
  ),
  maxScore: Type.Optional(
    Type.Union([
      Type.Number({ exclusiveMinimum: 0, maximum: 1e12 }),
      Type.Null(),
    ]),
  ),
};
export const ExamInputSchema = Type.Object(ExamProperties, {
  additionalProperties: false,
});
export const ExamPatchSchema = Type.Partial(
  Type.Object(ExamProperties, {
    additionalProperties: false,
    minProperties: 1,
  }),
);
export const ExamSchema = Type.Object(
  {
    ...baseProperties,
    title: Type.String(),
    subject: Type.String(),
    scheduledAt: Instant,
    timeZone: Zone,
    durationMinutes: NullableNumber,
    status: Status,
    score: NullableNumber,
    maxScore: NullableNumber,
    scorePercent: NullableNumber,
  },
  { additionalProperties: false },
);
export const EducationSummarySchema = Type.Object(
  {
    ...windowProperties,
    sessionCount: Type.Integer(),
    totalFocusedMinutes: Type.Number(),
    averageFocusedMinutes: NullableNumber,
    subjects: Type.Array(
      Type.Object(
        {
          subject: Type.String(),
          focusedMinutes: Type.Number(),
          sessionCount: Type.Integer(),
        },
        { additionalProperties: false },
      ),
    ),
    daily: Type.Array(dailyStudy),
    examinations: Type.Object(
      {
        count: Type.Integer(),
        completedCount: Type.Integer(),
        canceledCount: Type.Integer(),
        gradedCount: Type.Integer(),
        averageScorePercent: NullableNumber,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export const StudyPlanSchema = Type.Object(
  {
    subject: Type.String({ minLength: 1, maxLength: 100 }),
    startsAt: Instant,
    endsAt: Instant,
    timeZone: Zone,
  },
  { additionalProperties: false },
);
