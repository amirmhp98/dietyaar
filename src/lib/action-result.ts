import type { ZodError } from 'zod';
import { ServiceError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { t } from '@/lib/t';

/**
 * Uniform return type for server actions. Client components switch on `ok`;
 * they never see stack traces or internal messages.
 *
 *   const result = await createUserAction(values);
 *   if (!result.ok) { toast.error(result.error); return; }
 */
export type FieldErrors = Record<string, string[]>;

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      /** Tech spec § 7 error code when the failure came from a `ServiceError`. */
      code?: string;
      fieldErrors?: FieldErrors;
      /** Structured context from the `ServiceError` (e.g. `{ currentRevision }` on CONFLICT). */
      details?: unknown;
    };

export function ok(): ActionResult<void>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data: data as T };
}

export function fail(error: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** Zod issues → per-field messages, with the first message as the summary. */
export function fromZodError(error: ZodError): ActionResult<never> {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail(error.issues[0]?.message ?? t('validation.invalid'), fieldErrors);
}

/** ServiceError → its (already localised) message, code and details. Anything else is logged and replaced by a generic one. */
export function fromError(error: unknown): ActionResult<never> {
  if (error instanceof ServiceError) {
    return error.details === undefined
      ? { ok: false, error: error.message, code: error.code }
      : { ok: false, error: error.message, code: error.code, details: error.details };
  }
  logger.error({ err: error }, 'Unhandled error in server action');
  return fail(t('errors.unexpected'));
}
