import { Type } from 'typebox';
import { Instant, DateOnly } from './resource.js';
export const Zone = Type.String({
  minLength: 1,
  maxLength: 100,
  examples: ['Europe/Madrid'],
});
export const WindowSchema = Type.Object(
  { from: Instant, to: Instant, timeZone: Type.Optional(Zone) },
  {
    additionalProperties: false,
    description:
      'Explicit half-open interval; maximum 93 elapsed days. Default summary timezone UTC. At most 10,000 source rows per domain; otherwise narrow the interval.',
  },
);
export const windowProperties = { from: Instant, to: Instant, timeZone: Zone };
export const NullableNumber = Type.Union([Type.Number(), Type.Null()]);
export const dailySleep = Type.Object(
  { date: DateOnly, sleepMinutes: Type.Number(), sessionCount: Type.Integer() },
  { additionalProperties: false },
);
export const dailyStudy = Type.Object(
  {
    date: DateOnly,
    focusedMinutes: Type.Number(),
    sessionCount: Type.Integer(),
  },
  { additionalProperties: false },
);
