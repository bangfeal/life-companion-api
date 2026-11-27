import { Type } from 'typebox';
import { Instant, baseProperties } from '../../../shared/http/resource.js';
import {
  Zone,
  NullableNumber,
  windowProperties,
  dailySleep,
} from '../../../shared/http/time.js';
export const SleepProperties = {
  startsAt: Instant,
  endsAt: Instant,
  timeZone: Zone,
  awakeMinutes: Type.Optional(Type.Integer({ minimum: 0, maximum: 2880 })),
  kind: Type.Optional(Type.Union([Type.Literal('main'), Type.Literal('nap')])),
  quality: Type.Optional(
    Type.Union([Type.Integer({ minimum: 1, maximum: 5 }), Type.Null()]),
  ),
  notes: Type.Optional(
    Type.Union([Type.String({ minLength: 1, maxLength: 1000 }), Type.Null()]),
  ),
};
export const SleepInputSchema = Type.Object(SleepProperties, {
  additionalProperties: false,
});
export const SleepPatchSchema = Type.Partial(
  Type.Object(SleepProperties, {
    additionalProperties: false,
    minProperties: 1,
  }),
);
export const SleepSchema = Type.Object(
  {
    ...baseProperties,
    startsAt: Instant,
    endsAt: Instant,
    timeZone: Zone,
    awakeMinutes: Type.Integer(),
    kind: Type.Union([Type.Literal('main'), Type.Literal('nap')]),
    quality: Type.Union([Type.Integer(), Type.Null()]),
    notes: Type.Union([Type.String(), Type.Null()]),
    provenance: Type.Literal('manual'),
    durationMinutes: Type.Number(),
    sleepMinutes: Type.Number(),
  },
  { additionalProperties: false },
);
export const SleepSummarySchema = Type.Object(
  {
    ...windowProperties,
    sessionCount: Type.Integer(),
    mainSessionCount: Type.Integer(),
    napCount: Type.Integer(),
    totalSleepMinutes: Type.Number(),
    averageSleepMinutes: NullableNumber,
    bedtimeConsistency: Type.Object(
      {
        sampleCount: Type.Integer(),
        comparisonCount: Type.Integer(),
        meanAbsoluteShiftMinutes: NullableNumber,
      },
      { additionalProperties: false },
    ),
    daily: Type.Array(dailySleep),
  },
  { additionalProperties: false },
);
