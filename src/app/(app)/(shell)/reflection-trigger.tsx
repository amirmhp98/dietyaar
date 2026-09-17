'use client';

import { useEffect } from 'react';
import { getMorningMessageAction } from '@/actions/reflection.actions';
import { localDateFor } from '@/lib/time/local-date';
import { markReflectionRequested, REFLECTION_REQUESTED_KEY } from './reflection-card';

/**
 * First-visit trigger (product spec § 11, task 8.2): from any product page,
 * on mount and whenever the tab becomes visible again, request the message
 * for the current local date in the profile zone unless this session already
 * asked for that date. Fire-and-forget: it never blocks the page, never shows
 * anything, and never touches the composer. Today's card reads the result.
 */
export function ReflectionTrigger({ timeZone }: { timeZone: string }) {
  useEffect(() => {
    const maybeRequest = () => {
      if (document.visibilityState === 'hidden') return;
      const localDate = localDateFor(new Date(), timeZone);
      let requested: string | null = null;
      try {
        requested = sessionStorage.getItem(REFLECTION_REQUESTED_KEY);
      } catch {
        requested = null;
      }
      if (requested === localDate) return;
      markReflectionRequested(localDate);
      void getMorningMessageAction(localDate).catch(() => undefined);
    };
    maybeRequest();
    document.addEventListener('visibilitychange', maybeRequest);
    return () => document.removeEventListener('visibilitychange', maybeRequest);
  }, [timeZone]);
  return null;
}
