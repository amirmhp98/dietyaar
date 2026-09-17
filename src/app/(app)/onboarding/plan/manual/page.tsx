import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { getPlan } from '@/services/plan.service';
import { getOnboardingState, stepIndex } from '@/services/profile.service';
import { ManualSetupFlow } from './manual-setup-flow';

export const dynamic = 'force-dynamic';

/** Manual plan setup during onboarding (design-scope screen 2 "Manual setup"). */
export default async function OnboardingManualPlanPage() {
  const user = await requireAuth();
  const state = await getOnboardingState(user.id);
  if (state.step === 'DONE') redirect('/today');
  if (stepIndex(state.step) < stepIndex('PLAN')) redirect('/onboarding');
  const plan = await getPlan(user.id);
  const draft = plan?.draft?.kind === 'MANUAL' && plan.draftJson ? plan.draftJson : null;
  return (
    <main className="min-h-screen px-4 pt-6">
      <ManualSetupFlow mode="onboarding" initialDraft={draft} />
    </main>
  );
}
