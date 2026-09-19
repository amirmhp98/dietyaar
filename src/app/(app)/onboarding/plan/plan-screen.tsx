'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button, Progress } from '@/components/UiComponents';
import { t } from '@/lib/t';

/**
 * Onboarding steps after the six profile questions: the plan text (7), then
 * the review screens each count as a step (meals 8, targets 9, rules 10) and
 * "You're all set" closes the count, so the bar reaches 100 % only there.
 */
export const ONBOARDING_STEP = { ADD_PLAN: 7, MEALS: 8, TARGETS: 9, RULES: 10, READY: 11 } as const;
export const ONBOARDING_TOTAL_STEPS = ONBOARDING_STEP.READY;

export type PlanFlowMode = 'onboarding' | 'plan';

/** Position inside a step made of several screens; the bar advances within the step. */
export interface Substep {
  index: number;
  count: number;
}

/** Bar fill for `step`, or a fraction of the way through it when it has several screens. */
export function progressPercent(step: number, substep?: Substep): number {
  const within = substep ? (substep.index + 1) / substep.count : 1;
  return ((step - 1 + within) / ONBOARDING_TOTAL_STEPS) * 100;
}

/**
 * Screen chrome for the plan screens (7, 7b, 8a–8c, 9, manual wizard): the
 * onboarding progress row when `step` is given, a Back control, one title.
 * Inside the shell (My plan flows) the same chrome renders without progress.
 */
export function PlanScreen({
  step,
  substep,
  title,
  children,
  onBack,
  backHref,
}: {
  step?: number;
  substep?: Substep;
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
  backHref?: string;
}) {
  const back = onBack ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-11 w-11"
      aria-label={t('onboarding.back')}
      onClick={onBack}
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  ) : backHref ? (
    <Button asChild variant="ghost" size="icon" className="h-11 w-11">
      <Link href={backHref} aria-label={t('onboarding.back')}>
        <ArrowLeft className="h-5 w-5" />
      </Link>
    </Button>
  ) : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pb-8">
      <div className="space-y-2">
        <div className="flex h-11 items-center gap-2">
          {back}
          {step ? (
            <span className="text-xs text-muted-foreground">
              {t('onboarding.progress', { current: step, total: ONBOARDING_TOTAL_STEPS })}
            </span>
          ) : null}
        </div>
        {step ? (
          <Progress
            value={progressPercent(step, substep)}
            aria-label={t('onboarding.progress', { current: step, total: ONBOARDING_TOTAL_STEPS })}
          />
        ) : null}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/** Routes differ between onboarding (bare) and the My plan flows (shell). */
export function planRoutes(mode: PlanFlowMode) {
  return mode === 'onboarding'
    ? {
        add: '/onboarding/plan',
        manual: '/onboarding/plan/manual',
        review: '/onboarding/plan',
        done: '/onboarding/plan',
      }
    : { add: '/plan/add', manual: '/plan/add/manual', review: '/plan/review', done: '/plan' };
}
