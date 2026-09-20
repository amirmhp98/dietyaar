'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button, Progress } from '@/components/UiComponents';
import { IconAction } from '@/components/product/IconAction';
import { Logo } from '@/components/layout/Logo';
import { t } from '@/lib/t';

/**
 * Onboarding steps after the five profile questions: the plan text (6), then
 * the review screens each count as a step (meals 7, targets 8, notes 9) and
 * "You're all set" closes the count, so the bar reaches 100 % only there.
 */
export const ONBOARDING_STEP = { ADD_PLAN: 6, MEALS: 7, TARGETS: 8, NOTES: 9, READY: 10 } as const;
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
 * Screen chrome for the plan screens (6, 6b, 7a–7c, 8, manual wizard) and
 * the onboarding questions: the progress row when `step` is given (the bar
 * fills truthfully, B16), a Back control, the title in the display face at
 * 28 px. Inside the shell (My plan flows) the same chrome renders without
 * progress or the brand mark.
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
    <IconAction
      label={t('onboarding.back')}
      icon={ArrowLeft}
      className="-ms-2 [&_svg]:rtl:-scale-x-100"
      onClick={onBack}
    />
  ) : backHref ? (
    <Button asChild variant="ghost" size="icon" className="-ms-2">
      <Link href={backHref} aria-label={t('onboarding.back')} title={t('onboarding.back')}>
        <ArrowLeft className="rtl:-scale-x-100" aria-hidden="true" />
      </Link>
    </Button>
  ) : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pb-8">
      <div className="space-y-3">
        <div className="flex h-11 items-center gap-2">
          {back}
          {step ? (
            <>
              <Logo compact className="[&_svg]:size-7" />
              <span className="text-xs font-medium text-muted-foreground">
                {t('onboarding.progress', { current: step, total: ONBOARDING_TOTAL_STEPS })}
              </span>
            </>
          ) : null}
        </div>
        {step ? (
          <Progress
            value={progressPercent(step, substep)}
            className="h-1.5"
            aria-label={t('onboarding.progressLabel')}
          />
        ) : null}
      </div>
      <h1 className="font-display text-question font-semibold tracking-tight">{title}</h1>
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
