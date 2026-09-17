'use client';

import { useCallback, useEffect } from 'react';

/**
 * Opens the meal composer from anywhere (Today's "Log this meal", History's
 * "Log meal for this date", the shell button) without prop drilling: a DOM
 * event the shell island listens to. Product components stay action-free.
 */
export interface ComposerRequest {
  /** Preselect a plan slot (and option) — "Log this meal" on a slot row. */
  planSlotId?: string | null;
  planOptionId?: string | null;
  /** Log for a specific local date (History day page); defaults to today. */
  localDate?: string | null;
  /** Reuse a confirmed meal as a new draft. */
  reuseMealId?: string | null;
  /** Resume an existing server draft. */
  draftId?: string | null;
}

const EVENT = 'dietyaar:open-composer';

export function openComposer(request: ComposerRequest = {}): void {
  window.dispatchEvent(new CustomEvent<ComposerRequest>(EVENT, { detail: request }));
}

export function useComposerOpener(): (request?: ComposerRequest) => void {
  return useCallback((request?: ComposerRequest) => openComposer(request), []);
}

export function useComposerRequests(handler: (request: ComposerRequest) => void): void {
  useEffect(() => {
    const listener = (event: Event) =>
      handler((event as CustomEvent<ComposerRequest>).detail ?? {});
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  }, [handler]);
}
