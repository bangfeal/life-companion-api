import type {
  Event,
  EventInput,
  EventPatch,
  EventQuery,
} from '../domain/model.js';
export interface Repository {
  create(userId: string, input: EventInput): Promise<Event>;
  list(
    userId: string,
    query: EventQuery & { limit: number; offset: number },
  ): Promise<Event[]>;
  get(userId: string, id: string): Promise<Event | undefined>;
  update(
    userId: string,
    id: string,
    patch: EventPatch,
  ): Promise<Event | undefined>;
  delete(userId: string, id: string): Promise<boolean>;
}
