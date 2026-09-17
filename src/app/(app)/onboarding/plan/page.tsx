import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { localDateFor, weekdayOf } from '@/lib/time';
import { getPlan, slotsForWeekday } from '@/services/plan.service';
import { getOnboardingState, requireProfile, stepIndex } from '@/services/profile.service';
import { AddPlanFlow, type ImportState } from './add-plan-flow';
import { MANUAL_REVIEW_STEP } from './manual/steps';
import { PlanReviewFlow } from './plan-review-flow';
import { ReadyScreen } from './ready-screen';

export const dynamic = 'force-dynamic';

/**
 * Onboarding screens 7–9 (design-scope screen 2): which one renders follows
 * the plan's draft state, so a refresh or a return lands where the user left.
 */
export default async function OnboardingPlanPage() {
  const user = await requireAuth();
  const state = await getOnboardingState(user.id);
  if (state.step === 'DONE') redirect('/today');
  if (stepIndex(state.step) < stepIndex('PLAN')) redirect('/onboarding');
  const [profile, plan] = await Promise.all([requireProfile(user.id), getPlan(user.id)]);

  if (state.step === 'READY') {
    const weekday = weekdayOf(localDateFor(new Date(), profile.timeZone));
    const slots = plan ? slotsForWeekday(plan, weekday) : [];
    return (
      <Main>
        <ReadyScreen
          targetsOnly={plan?.structure === 'TARGETS_ONLY'}
          slots={slots.map((slot) => ({
            id: slot.id,
            originalName: slot.originalName,
            englishLabel: slot.englishLabel,
            optionCount: slot.options.length,
          }))}
        />
      </Main>
    );
  }

  const draft = plan?.draft ?? null;
  if (draft?.state === 'READY' && plan?.draftJson) {
    if (draft.kind === 'MANUAL' && plan.draftJson.manualStep !== MANUAL_REVIEW_STEP)
      redirect('/onboarding/plan/manual');
    return (
      <Main>
        <PlanReviewFlow mode="onboarding" initialDraft={plan.draftJson} draftKind={draft.kind} />
      </Main>
    );
  }

  const importState: ImportState =
    draft?.kind === 'IMPORT' ? (draft.state === 'PENDING' ? 'PENDING' : 'FAILED') : 'NONE';
  return (
    <Main>
      <AddPlanFlow
        mode="onboarding"
        userId={user.id}
        aiNoticeShown={profile.aiNoticePlanShownAt !== null}
        initialState={importState}
      />
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen px-4 pt-6">{children}</main>;
}
