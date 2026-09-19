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

// The island hydrates after the button (it sits behind a Suspense boundary),
// so a tap in that window would otherwise be lost: hold it until a listener mounts.
let listeners = 0;
let pending: ComposerRequest | null = null;

export function openComposer(request: ComposerRequest = {}): void {
  if (listeners === 0) {
    pending = request;
    return;
  }
  window.dispatchEvent(new CustomEvent<ComposerRequest>(EVENT, { detail: request }));
}

export function useComposerOpener(): (request?: ComposerRequest) => void {
  return useCallback((request?: ComposerRequest) => openComposer(request), []);
}

// A plain function on purpose: the React Compiler rewrites module-level
// mutable bindings inside hooks incorrectly (it read `pending` after nulling it).
function subscribe(handler: (request: ComposerRequest) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<ComposerRequest>).detail ?? {});
  window.addEventListener(EVENT, listener);
  listeners += 1;
  const held = pending;
  pending = null;
  if (held) handler(held);
  return () => {
    listeners -= 1;
    window.removeEventListener(EVENT, listener);
  };
}

export function useComposerRequests(handler: (request: ComposerRequest) => void): void {
  useEffect(() => subscribe(handler), [handler]);
}
