import { ManualSetupFlow } from '@/app/(app)/onboarding/plan/manual/manual-setup-flow';
import { requireOnboarded } from '@/lib/auth';
import { getPlan } from '@/services/plan.service';

export const dynamic = 'force-dynamic';

/** Manual set-up from My plan (first plan or Replace). */
export default async function PlanManualPage() {
  const user = await requireOnboarded();
  const plan = await getPlan(user.id);
  const draft = plan?.draft?.kind === 'MANUAL' && plan.draftJson ? plan.draftJson : null;
  return <ManualSetupFlow mode="plan" initialDraft={draft} />;
}
