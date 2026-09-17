'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button, Progress } from '@/components/UiComponents';
import { t } from '@/lib/t';

/** Onboarding shows "Step 7 of 8" / "Step 8 of 8" above the plan screens. */
export const ONBOARDING_TOTAL_STEPS = 8;

export type PlanFlowMode = 'onboarding' | 'plan';

/**
 * Screen chrome for the plan screens (7, 7b, 8a–8c, 9, manual wizard): the
 * onboarding progress row when `step` is given, a Back control, one title.
 * Inside the shell (My plan flows) the same chrome renders without progress.
 */
export function PlanScreen({
  step,
  title,
  children,
  onBack,
  backHref,
}: {
  step?: number;
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
            value={(step / ONBOARDING_TOTAL_STEPS) * 100}
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
