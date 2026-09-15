'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';
let listeners: Array<() => void> = [];

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  html.classList.toggle('dark', theme === 'dark');
  html.setAttribute('data-theme', theme);
}

function getSnapshot(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'dark';
  } catch {
    return 'dark';
  }
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage unavailable (private mode); still apply for this page view
  }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'dark' as const);
  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme]);
  return { theme, isDark: theme === 'dark', setTheme, toggle };
}
