/**
 * In-process sliding-window rate limiter (tech spec § 8): sign-up per IP,
 * uploads per user. Resets on deploy; at more than one replica it moves to a
 * table (decision 010).
 */
const windows = new Map<string, number[]>();

export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  const cutoff = now - windowMs;
  const hits = (windows.get(key) ?? []).filter((at) => at > cutoff);
  if (hits.length >= limit) {
    windows.set(key, hits);
    return true;
  }
  hits.push(now);
  windows.set(key, hits);
  return false;
}

/** Test hook. */
export function resetRateLimits(): void {
  windows.clear();
}
