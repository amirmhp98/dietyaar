import { redirect } from 'next/navigation';
import { PlanReviewFlow } from '@/app/(app)/onboarding/plan/plan-review-flow';
import { requireOnboarded } from '@/lib/auth';
import { getPlan } from '@/services/plan.service';

export const dynamic = 'force-dynamic';

/** Review an import, manual set-up or edit from My plan (journey J10, J12). */
export default async function PlanReviewPage() {
  const user = await requireOnboarded();
  const plan = await getPlan(user.id);
  const draft = plan?.draft;
  if (!plan || !draft || draft.state !== 'READY' || !plan.draftJson) redirect('/plan');
  if (draft.kind === 'MANUAL' && plan.draftJson.manualStep !== 'review')
    redirect('/plan/add/manual');
  return <PlanReviewFlow mode="plan" initialDraft={plan.draftJson} draftKind={draft.kind} />;
}
