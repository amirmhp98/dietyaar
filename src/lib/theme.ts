'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  APPEARANCE_COOKIE,
  APPEARANCE_COOKIE_MAX_AGE,
  parseAppearance,
  type AppearanceValue,
} from '@/lib/theme-cookie';

/**
 * Three-state appearance store (product spec § 12): system | light | dark,
 * default system. The cookie lets the server render the right class on the
 * first paint; the inline script in the root layout resolves `system` before
 * paint and follows OS changes. Signed-in users also persist the choice on
 * their profile through `updatePreferencesAction`.
 */
export type Appearance = AppearanceValue;

let listeners: Array<() => void> = [];

export function resolveAppearance(pref: Appearance, prefersDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return prefersDark ? 'dark' : 'light';
  return pref;
}

function readCookie(): Appearance {
  if (typeof document === 'undefined') return 'system';
  const match = document.cookie.match(new RegExp(`(?:^|; )${APPEARANCE_COOKIE}=([^;]*)`));
  return parseAppearance(match?.[1]);
}

function applyAppearance(pref: Appearance) {
  const html = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = resolveAppearance(pref, prefersDark);
  html.classList.toggle('dark', resolved === 'dark');
  html.setAttribute('data-theme', resolved);
  html.setAttribute('data-appearance', pref);
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function setAppearance(pref: Appearance) {
  document.cookie = `${APPEARANCE_COOKIE}=${pref}; path=/; max-age=${APPEARANCE_COOKIE_MAX_AGE}; samesite=lax`;
  applyAppearance(pref);
  listeners.forEach((l) => l());
}

export function useAppearance() {
  const appearance = useSyncExternalStore(subscribe, readCookie, () => 'system' as const);
  const set = useCallback((pref: Appearance) => setAppearance(pref), []);
  return { appearance, setAppearance: set };
}
