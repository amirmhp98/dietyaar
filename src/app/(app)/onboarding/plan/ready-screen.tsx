'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { finishOnboardingAction } from '@/actions/onboarding-plan.actions';
import { NameLabel } from '@/components/product/NameLabel';
import { Button, toast } from '@/components/UiComponents';
import { t, tp } from '@/lib/t';
import { ONBOARDING_STEP, PlanScreen } from './plan-screen';

export interface ReadySlot {
  id: string;
  originalName: string;
  englishLabel: string;
  optionCount: number;
}

/**
 * Screen 8 "Ready": today's slots, one line about the daily reflection, and
 * two ways out. "Log your first meal" lands on Today with `?compose=1`, which
 * the composer island reads to open itself.
 */
export function ReadyScreen({ slots, targetsOnly }: { slots: ReadySlot[]; targetsOnly: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function finish(href: string) {
    startTransition(async () => {
      const result = await finishOnboardingAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.replace(href);
    });
  }

  return (
    <PlanScreen step={ONBOARDING_STEP.READY} title={t('plan.ready.title')}>
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t('plan.ready.today')}</h2>
        {targetsOnly || slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('plan.page.noSlots')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {slots.map((slot) => (
              <li
                key={slot.id}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-2"
              >
                <NameLabel originalName={slot.originalName} englishLabel={slot.englishLabel} />
                {slot.optionCount > 1 ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {tp('plan.option.count', slot.optionCount)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-sm text-muted-foreground">{t('plan.ready.reflection')}</p>
      <div className="grid gap-3">
        <Button
          type="button"
          className="h-11 w-full"
          loading={pending}
          onClick={() => finish('/today?compose=1')}
        >
          {t('plan.ready.logFirst')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          disabled={pending}
          onClick={() => finish('/today')}
        >
          {t('plan.ready.goToToday')}
        </Button>
      </div>
    </PlanScreen>
  );
}
