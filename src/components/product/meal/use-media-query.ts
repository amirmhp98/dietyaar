'use client';

import { useCallback, useSyncExternalStore } from 'react';

const lists = new Map<string, MediaQueryList>();

function listFor(query: string): MediaQueryList {
  let list = lists.get(query);
  if (!list) {
    list = window.matchMedia(query);
    lists.set(query, list);
  }
  return list;
}

const serverSnapshot = () => false;

/**
 * True while `query` matches. False on the server and until hydration, so
 * the first paint is the layout that works everywhere and the device-specific
 * one follows right after mount.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = listFor(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => listFor(query).matches, serverSnapshot);
}

/** The primary pointer is a finger (phones, tablets): camera + gallery instead of one file picker. */
export function useCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/** md+ viewport: the composer is a centered dialog instead of a bottom sheet. */
export function useIsWide(): boolean {
  return useMediaQuery('(min-width: 768px)');
}
