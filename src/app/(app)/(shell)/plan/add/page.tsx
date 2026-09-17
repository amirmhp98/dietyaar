import { redirect } from 'next/navigation';
import { AddPlanFlow, type ImportState } from '@/app/(app)/onboarding/plan/add-plan-flow';
import { requireOnboarded } from '@/lib/auth';
import { getPlan } from '@/services/plan.service';
import { requireProfile } from '@/services/profile.service';

export const dynamic = 'force-dynamic';

/** "Add your plan" from My plan: first plan (J13) or Replace (J10). */
export default async function PlanAddPage() {
  const user = await requireOnboarded();
  const [profile, plan] = await Promise.all([requireProfile(user.id), getPlan(user.id)]);
  const draft = plan?.draft ?? null;
  if (draft?.kind === 'IMPORT' && draft.state === 'READY') redirect('/plan/review');
  const importState: ImportState =
    draft?.kind === 'IMPORT' ? (draft.state === 'PENDING' ? 'PENDING' : 'FAILED') : 'NONE';
  return (
    <AddPlanFlow
      mode="plan"
      userId={user.id}
      aiNoticeShown={profile.aiNoticePlanShownAt !== null}
      initialState={importState}
    />
  );
}
