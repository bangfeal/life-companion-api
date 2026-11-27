export class IdentityError extends Error {
  constructor(public readonly statusCode: 400 | 401 | 409 | 503) {
    super('Identity operation failed');
  }
}
