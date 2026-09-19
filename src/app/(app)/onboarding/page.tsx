import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { onboardingStepSchema } from '@/lib/validations/profile';
import { getOnboardingState, stepIndex } from '@/services/profile.service';
import { OnboardingFlow } from './onboarding-flow';

export const dynamic = 'force-dynamic';

/**
 * The questions resume at the saved pointer. `?step=<question>` reopens one
 * the user already answered (Back from the plan step); the pointer itself
 * only moves forward, so saving there returns them to where they were.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const user = await requireAuth();
  const [state, { step: requested }] = await Promise.all([
    getOnboardingState(user.id),
    searchParams,
  ]);
  if (state.step === 'DONE') redirect('/today');
  const reopened = onboardingStepSchema.safeParse(requested);
  const initialStep =
    reopened.success && stepIndex(reopened.data) <= stepIndex(state.step)
      ? reopened.data
      : state.step;
  return <OnboardingFlow initialStep={initialStep} initialValues={state.values} />;
}
