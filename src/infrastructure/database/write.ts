import { ApplicationError } from '../../shared/domain/validation.js';
// Translate relationship and interval-exclusion conflicts at the persistence boundary.
export async function databaseWrite<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    if (
      (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        ['23503', '23P01'].includes(String(error.code))) ||
      (typeof cause === 'object' &&
        cause !== null &&
        'code' in cause &&
        ['23503', '23P01'].includes(String(cause.code)))
    )
      throw new ApplicationError(409);
    throw error;
  }
}
