import { Type } from 'typebox';
export const ProblemSchema = Type.Object(
  {
    type: Type.String(),
    title: Type.String(),
    status: Type.Integer(),
    detail: Type.String(),
  },
  { additionalProperties: false },
);
