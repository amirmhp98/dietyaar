'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { CircleAlert, Loader2 } from 'lucide-react';
import { continueToTodayAction } from '@/actions/onboarding-plan.actions';
import {
  cancelPlanImportAction,
  getPlanImportStatusAction,
  retryPlanImportAction,
  startPlanImportAction,
} from '@/actions/plan.actions';
import { acknowledgeAiNoticeAction, skipPlanAction } from '@/actions/profile.actions';
import { AiNoticeSheet } from '@/components/product/AiNoticeSheet';
import { Disclosure } from '@/components/product/Disclosure';
import { Surface } from '@/components/product/Surface';
import { Button, FormField, Textarea, toast } from '@/components/UiComponents';
import { formatNumber } from '@/lib/format';
import { t } from '@/lib/t';
import { PLAN_TEXT_MAX } from '@/lib/validations/plan';
import { ONBOARDING_STEP, PlanScreen, planRoutes, type PlanFlowMode } from './plan-screen';

export type ImportState = 'NONE' | 'PENDING' | 'READY' | 'FAILED';

const POLL_MS = 3_000;
const SLOW_AFTER_MS = 15_000;

/**
 * Screen 6 "Add your plan" and 6b "Preparing your plan" (design-scope
 * screen 2, product spec § 5). The pasted text is mirrored in
 * sessionStorage so a failed import keeps it on screen; the AI notice shows
 * once before the first import.
 */
export function AddPlanFlow({
  mode,
  userId,
  aiNoticeShown,
  initialState,
}: {
  mode: PlanFlowMode;
  userId: string;
  aiNoticeShown: boolean;
  initialState: ImportState;
}) {
  const router = useRouter();
  const routes = planRoutes(mode);
  const storageKey = `plan-text:${userId}`;
  const [text, setText] = useState('');
  const [state, setState] = useState<ImportState>(initialState);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeAcknowledged, setNoticeAcknowledged] = useState(aiNoticeShown);
  const [pending, startTransition] = useTransition();
  const [slow, setSlow] = useState(false);
  const step = mode === 'onboarding' ? ONBOARDING_STEP.ADD_PLAN : undefined;

  useEffect(() => {
    let mirrored: string | null = null;
    try {
      mirrored = sessionStorage.getItem(storageKey);
    } catch {
      // storage unavailable
    }
    // After hydration, so the server-rendered (empty) textarea matches.
    if (mirrored) queueMicrotask(() => setText(mirrored ?? ''));
  }, [storageKey]);

  const mirror = useCallback(
    (value: string) => {
      try {
        if (value) sessionStorage.setItem(storageKey, value);
        else sessionStorage.removeItem(storageKey);
      } catch {
        // storage unavailable
      }
    },
    [storageKey],
  );

  const count = text.length;
  const overLimit = count > PLAN_TEXT_MAX;
  const nearLimit = count >= PLAN_TEXT_MAX * 0.8;

  function startImport() {
    startTransition(async () => {
      const result = await startPlanImportAction({ sourceText: text });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSlow(false);
      setState('PENDING');
    });
  }

  function submit() {
    if (overLimit || text.trim() === '') return;
    mirror(text);
    if (!noticeAcknowledged) {
      setNoticeOpen(true);
      return;
    }
    startImport();
  }

  function acknowledgeAndStart() {
    setNoticeOpen(false);
    startTransition(async () => {
      const result = await acknowledgeAiNoticeAction('PLAN');
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNoticeAcknowledged(true);
      startImport();
    });
  }

  function tryAgain() {
    if (text.trim() !== '' && !overLimit) {
      startImport();
      return;
    }
    startTransition(async () => {
      const result = await retryPlanImportAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSlow(false);
      setState('PENDING');
    });
  }

  function goManual() {
    setNoticeOpen(false);
    router.push(routes.manual);
  }

  // ── 6b: preparing ──────────────────────────────────────────
  const onReady = useCallback(() => {
    mirror('');
    if (mode === 'onboarding') router.refresh();
    else router.push(routes.review);
  }, [mirror, mode, router, routes.review]);

  useImportPolling(state === 'PENDING', {
    onReady,
    onFailed: (next) => setState(next),
    onSlow: () => setSlow(true),
  });

  if (state === 'PENDING') {
    return (
      <PlanScreen step={step} title={t('plan.preparing.title')}>
        <Surface variant="note" role="status" className="flex items-start gap-3 text-sm">
          <Loader2
            className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
          <p>{slow ? t('plan.preparing.slow') : t('plan.preparing.body')}</p>
        </Surface>
        {slow ? (
          mode === 'onboarding' ? (
            <form action={continueToTodayAction}>
              <Button type="submit" className="w-full">
                {t('plan.preparing.continueToToday')}
              </Button>
            </form>
          ) : (
            <Button asChild className="w-full">
              <Link href="/today">{t('plan.preparing.continueToToday')}</Link>
            </Button>
          )
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelPlanImportAction();
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setState('NONE');
            })
          }
        >
          {t('plan.preparing.cancel')}
        </Button>
      </PlanScreen>
    );
  }

  // ── 6: add your plan (also the failed state, text kept) ────
  return (
    <PlanScreen
      step={step}
      title={t('plan.add.title')}
      backHref={mode === 'plan' ? '/plan' : '/onboarding?step=DISPLAY_NAME'}
    >
      {state === 'FAILED' ? (
        <Surface variant="note" role="alert" className="space-y-3" data-testid="import-failed">
          <p className="flex items-start gap-2 font-medium">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t('plan.add.failedTitle')}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {text.trim() === '' ? t('plan.add.failedBodyKept') : t('plan.add.failedBody')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" loading={pending} onClick={tryAgain}>
              {t('plan.add.tryAgain')}
            </Button>
            <Button type="button" variant="outline" onClick={goManual}>
              {t('plan.add.setUpManually')}
            </Button>
          </div>
        </Surface>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {mode === 'plan' ? t('plan.add.replaceHint') : t('plan.add.intro')}
      </p>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <FormField
          label={t('plan.add.label')}
          error={
            overLimit
              ? t('plan.add.overLimit', {
                  max: formatNumber(PLAN_TEXT_MAX),
                  count: formatNumber(count),
                })
              : undefined
          }
          helperText={
            nearLimit
              ? t('plan.add.count', {
                  count: formatNumber(count),
                  max: formatNumber(PLAN_TEXT_MAX),
                })
              : undefined
          }
        >
          <Textarea
            dir="auto"
            rows={10}
            className="min-h-56 text-base"
            placeholder={t('plan.add.placeholder')}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              mirror(e.target.value);
            }}
          />
        </FormField>
        <Disclosure label={t('plan.add.exampleToggle')} testId="plan-example">
          <Surface variant="note" padding="sm">
            <p className="whitespace-pre-wrap text-sm" dir="auto">
              <bdi>{t('plan.add.example')}</bdi>
            </p>
          </Surface>
        </Disclosure>
        <div className="grid gap-3">
          <Button
            type="submit"
            variant={state === 'FAILED' ? 'outline' : 'default'}
            className="w-full"
            loading={pending}
            disabled={overLimit || text.trim() === ''}
          >
            {t('plan.add.continue')}
          </Button>
          <Button
            type="button"
            variant={state === 'FAILED' ? 'ghost' : 'outline'}
            className="w-full"
            disabled={pending}
            onClick={goManual}
          >
            {t('plan.add.manual')}
          </Button>
          {mode === 'onboarding' ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={pending}
              onClick={() => startTransition(() => skipPlanAction())}
            >
              {t('onboarding.plan.noPlanYet')}
            </Button>
          ) : null}
        </div>
      </form>
      <AiNoticeSheet
        kind="PLAN"
        open={noticeOpen}
        onOpenChange={setNoticeOpen}
        onContinue={acknowledgeAndStart}
        onManual={goManual}
      />
    </PlanScreen>
  );
}

/** Polls the import every 3 s while pending; reports slow after 15 s. */
export function useImportPolling(
  active: boolean,
  handlers: {
    onReady: () => void;
    onFailed: (state: 'FAILED' | 'NONE') => void;
    onSlow?: () => void;
  },
) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const startedAt = Date.now();
    const slowTimer = setTimeout(() => ref.current.onSlow?.(), SLOW_AFTER_MS);
    async function tick() {
      if (stopped) return;
      const result = await getPlanImportStatusAction();
      if (stopped) return;
      if (result.ok && result.data.state === 'READY') return ref.current.onReady();
      if (result.ok && (result.data.state === 'FAILED' || result.data.state === 'NONE'))
        return ref.current.onFailed(result.data.state);
      if (Date.now() - startedAt >= SLOW_AFTER_MS) ref.current.onSlow?.();
      timer = setTimeout(tick, POLL_MS);
    }
    let timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(slowTimer);
    };
  }, [active]);
}
