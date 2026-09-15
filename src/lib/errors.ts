/**
 * Thrown by services for expected, user-facing failures ("username taken",
 * "user not found"). Actions turn it into an `ActionResult` via `fromError`.
 * The message is shown to the user, so write it in Persian.
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    readonly code: string = 'SERVICE_ERROR',
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
