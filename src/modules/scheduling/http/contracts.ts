import { Type } from 'typebox';
import { baseProperties, Id, Instant } from '../../../shared/http/resource.js';
const Title = Type.String({ minLength: 1, maxLength: 200 });
const NullableDescription = Type.Union([
  Type.String({ minLength: 1, maxLength: 2000 }),
  Type.Null(),
]);
const NullableId = Type.Union([Id, Type.Null()]);
const Zone = Type.String({ minLength: 1, maxLength: 100 });
export const EventSchema = Type.Object(
  {
    ...baseProperties,
    title: Title,
    description: NullableDescription,
    taskId: NullableId,
    startsAt: Instant,
    endsAt: Instant,
    timeZone: Zone,
  },
  { additionalProperties: false },
);
