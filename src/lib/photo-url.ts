import 'server-only';
import { createHash } from 'node:crypto';

/**
 * Photo URLs are account-bound (tech spec § 7, decision 016): the `s` tag is
 * the first 12 hex characters of the SHA-256 of the raw session token, so a
 * browser cache entry from one session never serves another, and logout
 * invalidates every cached URL. Pages read the raw token from the `session`
 * cookie and build URLs with `photoUrl`; `GET /api/photos/[id]` checks the
 * tag with `photoTag`.
 */

export const PHOTO_TAG_LENGTH = 12;

export function photoTag(rawSessionToken: string): string {
  return createHash('sha256').update(rawSessionToken).digest('hex').slice(0, PHOTO_TAG_LENGTH);
}

export function photoUrl(uploadId: string, rawSessionToken: string): string {
  return `/api/photos/${encodeURIComponent(uploadId)}?s=${photoTag(rawSessionToken)}`;
}
