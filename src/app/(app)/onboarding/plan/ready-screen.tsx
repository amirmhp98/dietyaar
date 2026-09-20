'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Sparkles, Sun } from 'lucide-react';
import { finishOnboardingAction } from '@/actions/onboarding-plan.actions';
import { Illustration } from '@/components/product/Illustration';
import { NameLabel } from '@/components/product/NameLabel';
import { SectionHeader } from '@/components/product/SectionHeader';
import { Surface } from '@/components/product/Surface';
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
 * Screen 8 "Ready": the illustration, today's slots, one line about the
 * daily reflection, and two ways out. "Log your first meal" lands on Today
 * with `?compose=1`, which the composer island reads to open itself.
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
      <div className="flex justify-center">
        <Illustration name="ready" />
      </div>
      <section className="space-y-3" aria-labelledby="ready-today-title">
        <SectionHeader icon={Sun} title={t('plan.ready.today')} id="ready-today-title" />
        {targetsOnly || slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('plan.page.noSlots')}</p>
        ) : (
          <Surface variant="list" as="ul">
            {slots.map((slot) => (
              <li
                key={slot.id}
                className="flex min-h-11 items-center justify-between gap-3 px-3 py-2"
              >
                <NameLabel originalName={slot.originalName} englishLabel={slot.englishLabel} />
                {slot.optionCount > 1 ? (
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {tp('plan.option.count', slot.optionCount)}
                  </span>
                ) : null}
              </li>
            ))}
          </Surface>
        )}
      </section>
      <Surface variant="note" className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t('plan.ready.reflection')}</p>
      </Surface>
      <div className="grid gap-3">
        <Button
          type="button"
          className="w-full"
          loading={pending}
          onClick={() => finish('/today?compose=1')}
        >
          {t('plan.ready.logFirst')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={() => finish('/today')}
        >
          {t('plan.ready.goToToday')}
        </Button>
      </div>
    </PlanScreen>
  );
}
