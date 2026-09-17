'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  getMorningMessageAction,
  setReflectionCollapsedAction,
  updateReflectionAction,
} from '@/actions/reflection.actions';
import { toast } from '@/components/UiComponents';
import { ReflectionCard, type ReflectionPhase } from '@/components/product/ReflectionCard';
import { t } from '@/lib/t';
import type { ReflectionCard as ReflectionCardData } from '@/services/reflection.service';

/** Poll cadence while GENERATING (tech spec § 10.3): 2 s, up to 25 s, past the 20 s takeover. */
const POLL_MS = 2_000;
const POLL_LIMIT_MS = 25_000;
/** Shared with the shell trigger so the first visit makes one request, not two. */
export const REFLECTION_REQUESTED_KEY = 'reflection-requested';

export function markReflectionRequested(localDate: string) {
  try {
    sessionStorage.setItem(REFLECTION_REQUESTED_KEY, localDate);
  } catch {
    // Private mode or blocked storage: the trigger simply asks again.
  }
}

/**
 * Today's reflection island: requests (or reads) the day's message on mount,
 * polls while it is being prepared, and persists the collapse choice per date.
 * Never blocks the page; logging stays usable throughout.
 */
export function ReflectionCardIsland({ localDate }: { localDate: string }) {
  const [phase, setPhase] = useState<ReflectionPhase>('LOADING');
  const [card, setCard] = useState<ReflectionCardData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [updating, startUpdate] = useTransition();

  // One request per (date, attempt); polls while GENERATING until the limit.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    markReflectionRequested(localDate);
    const poll = async () => {
      const result = await getMorningMessageAction(localDate);
      if (!active) return;
      if (!result.ok) {
        setPhase('TIMED_OUT');
        return;
      }
      setCard(result.data);
      if (result.data.status === 'READY') {
        setCollapsed(result.data.collapsed);
        setPhase('READY');
        return;
      }
      if (Date.now() - startedAt >= POLL_LIMIT_MS) {
        setPhase('TIMED_OUT');
        return;
      }
      setPhase('GENERATING');
      timer = setTimeout(() => void poll(), POLL_MS);
    };
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [localDate, attempt]);

  function retry() {
    setPhase('LOADING');
    setAttempt((n) => n + 1);
  }

  function toggleCollapsed(next: boolean) {
    setCollapsed(next);
    void setReflectionCollapsedAction(localDate, next).then((result) => {
      if (!result.ok) toast.error(result.error);
    });
  }

  function update() {
    startUpdate(async () => {
      const result = await updateReflectionAction(localDate);
      if (!result.ok) {
        // DAILY_AI_CAP and the others keep the current paragraph on screen.
        toast.error(result.error);
        return;
      }
      setCard(result.data);
      if (result.data.status === 'READY') {
        setPhase('READY');
        toast.success(t('reflection.updated'));
      } else retry();
    });
  }

  return (
    <ReflectionCard
      phase={phase}
      paragraph={card?.paragraph ?? null}
      stale={card?.stale ?? false}
      collapsed={collapsed}
      onToggleCollapsed={toggleCollapsed}
      onUpdate={update}
      onRetry={retry}
      updating={updating}
    />
  );
}
