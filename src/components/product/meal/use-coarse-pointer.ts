'use client';

import { useSyncExternalStore } from 'react';

const COARSE_QUERY = '(pointer: coarse)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(COARSE_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

const getSnapshot = () => window.matchMedia(COARSE_QUERY).matches;
const getServerSnapshot = () => false;

/**
 * True when the primary pointer is a finger (phones, tablets). False on the
 * server and until hydration, so the first paint is the single desktop
 * control, which works everywhere; touch devices switch to camera + gallery
 * right after mount.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
