/**
 * Thrown by services for expected, user-facing failures ("username taken",
 * "user not found"). Actions turn it into an `ActionResult` via `fromError`.
 * The message is shown to the user, so it comes from `t()`. `code` is one of
 * the tech spec § 7 codes; `details` carries structured context the client
 * can act on (e.g. `{ currentRevision }` on `CONFLICT`).
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    readonly code: string = 'SERVICE_ERROR',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
