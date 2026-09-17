import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { getOnboardingState } from '@/services/profile.service';
import { OnboardingFlow } from './onboarding-flow';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await requireAuth();
  const state = await getOnboardingState(user.id);
  if (state.step === 'DONE') redirect('/today');
  return <OnboardingFlow initialStep={state.step} initialValues={state.values} />;
}
