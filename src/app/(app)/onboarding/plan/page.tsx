import { redirect } from 'next/navigation';
import { Button } from '@/components/UiComponents';
import { requireAuth } from '@/lib/auth';
import { t } from '@/lib/t';
import { getOnboardingState, stepIndex } from '@/services/profile.service';
import { skipPlanAction } from '@/actions/profile.actions';

export const dynamic = 'force-dynamic';

/** Placeholder for screen 7 until the plan module lands (phase 4). */
export default async function OnboardingPlanPage() {
  const user = await requireAuth();
  const state = await getOnboardingState(user.id);
  if (state.step === 'DONE') redirect('/today');
  if (stepIndex(state.step) < stepIndex('PLAN')) redirect('/onboarding');
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 pb-8 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('onboarding.plan.placeholderTitle')}
      </h1>
      <p className="text-sm text-muted-foreground">{t('onboarding.plan.placeholderBody')}</p>
      <form action={skipPlanAction}>
        <Button type="submit" className="h-11 w-full">
          {t('onboarding.plan.continueToToday')}
        </Button>
      </form>
    </main>
  );
}
