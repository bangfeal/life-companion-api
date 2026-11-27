import { ApplicationError } from '../../shared/domain/validation.js';
// Translate a deleted/changed relationship at the persistence boundary.
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
        error.code === '23503') ||
      (typeof cause === 'object' &&
        cause !== null &&
        'code' in cause &&
        cause.code === '23503')
    )
      throw new ApplicationError(409);
    throw error;
  }
}
