'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { countAffectedMealsAction } from '@/actions/onboarding-plan.actions';
import {
  confirmPlanAction,
  discardPlanDraftAction,
  estimateDraftBaselineAction,
  getPlanDraftAction,
  updatePlanDraftAction,
} from '@/actions/plan.actions';
import { NotesReview } from '@/components/product/plan-review/NotesReview';
import { SlotReview, normalize } from '@/components/product/plan-review/SlotReview';
import { TargetsReview, type EstimateState } from '@/components/product/plan-review/TargetsReview';
import { WeekdaySummary } from '@/components/product/plan-review/WeekdaySummary';
import { slotsOfWeekday, weekdaysInPlanOrder } from '@/components/product/plan-review/helpers';
import { Button, toast } from '@/components/UiComponents';
import type { ActionResult } from '@/lib/action-result';
import { assignWindows, windowOf } from '@/lib/rubric/windows';
import { t } from '@/lib/t';
import type { DraftSection, DraftSlot, PlanDraft } from '@/lib/validations/plan';
import { ONBOARDING_STEP, PlanScreen, planRoutes, type PlanFlowMode } from './plan-screen';

type Screen =
  { kind: 'slot'; key: string } | { kind: 'summary' } | { kind: 'targets' } | { kind: 'notes' };

/**
 * Screens 7a–7c for import, manual and edit drafts. Owns the draft and its
 * revision, autosaves every screen through `updatePlanDraftAction`, reloads
 * on CONFLICT, and confirms. Product components only get data + callbacks.
 */
export function PlanReviewFlow({
  mode,
  initialDraft,
  draftKind,
}: {
  mode: PlanFlowMode;
  initialDraft: PlanDraft;
  draftKind: 'IMPORT' | 'MANUAL' | 'EDIT';
}) {
  const router = useRouter();
  const routes = planRoutes(mode);
  const [draft, setDraft] = useState(initialDraft);
  const [reviewEach, setReviewEach] = useState(false);
  const [saving, setSaving] = useState(false);
  const [estimate, setEstimate] = useState<EstimateState>('idle');
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [affected, setAffected] = useState<number | null>(null);
  const stepFor = (step: number) => (mode === 'onboarding' ? step : undefined);

  // ── Order of the slot screens ─────────────────────────────
  const byWeekday = draft.structure === 'BY_WEEKDAY';
  const weekdays = useMemo(() => weekdaysInPlanOrder(draft.slots), [draft.slots]);
  const firstDay = weekdays[0];
  const firstDaySlots = useMemo(
    () => (byWeekday && firstDay !== undefined ? slotsOfWeekday(draft, firstDay) : draft.slots),
    [byWeekday, draft, firstDay],
  );
  const otherDays = useMemo(
    () =>
      byWeekday
        ? weekdays.slice(1).map((weekday) => ({ weekday, slots: slotsOfWeekday(draft, weekday) }))
        : [],
    [byWeekday, draft, weekdays],
  );
  const slotOrder = useMemo(
    () => [...firstDaySlots, ...(reviewEach ? otherDays.flatMap((d) => d.slots) : [])],
    [firstDaySlots, otherDays, reviewEach],
  );
  const hasSlots = draft.structure !== 'TARGETS_ONLY' && slotOrder.length > 0;
  /** The windows confirm will write, previewed from the current names (product spec § 6). */
  const windows = useMemo(
    () => new Map(assignWindows(draft.slots).map((s) => [s.key, windowOf(s)])),
    [draft.slots],
  );
  const hasSummary = byWeekday && !reviewEach && otherDays.length > 0;
  /** Screens of the meals step: one per slot, plus the weekday summary when it shows. */
  const mealScreens = slotOrder.length + (hasSummary ? 1 : 0);

  const [screen, setScreen] = useState<Screen>(() => {
    // An edit draft arrives fully "reviewed" (it is the active plan); walk it from the start.
    if (hasSlots && (draftKind === 'EDIT' || !draft.reviewed.meals)) {
      const first =
        (draftKind === 'EDIT' ? undefined : slotOrder.find((s) => !s.reviewed)) ?? slotOrder[0];
      return { kind: 'slot', key: first.key };
    }
    if (draftKind === 'EDIT' || !draft.reviewed.targets) return { kind: 'targets' };
    return { kind: 'notes' };
  });

  // ── Saving ─────────────────────────────────────────────────
  const reload = useCallback(async () => {
    const result = await getPlanDraftAction();
    if (result.ok && result.data) {
      setDraft(result.data);
      toast.error(t('plan.review.conflictReloaded'));
    }
  }, []);

  const save = useCallback(
    async (section: DraftSection, payload: unknown, from = draft): Promise<PlanDraft | null> => {
      const result = await updatePlanDraftAction({
        draftRevision: from.draftRevision,
        section,
        payload,
      });
      return handle(result, reload, setDraft);
    },
    [draft, reload],
  );

  /** One busy flag per user gesture, however many saves it needs. */
  async function busy(work: () => Promise<void>) {
    setSaving(true);
    try {
      await work();
    } finally {
      setSaving(false);
    }
  }

  // ── 7b: estimate on entry when needed ──────────────────────
  const estimateRan = useRef(false);
  const runEstimate = useCallback(
    async (from: PlanDraft) => {
      setEstimate('running');
      setEstimateError(null);
      const result = await estimateDraftBaselineAction({ draftRevision: from.draftRevision });
      if (result.ok) {
        setDraft(result.data);
        setEstimate('idle');
        return;
      }
      if (result.code === 'CONFLICT') await reload();
      setEstimate('failed');
      setEstimateError(result.error);
    },
    [reload],
  );
  useEffect(() => {
    if (screen.kind !== 'targets' || estimateRan.current) return;
    estimateRan.current = true;
    if (draft.structure !== 'TARGETS_ONLY' && needsEstimate(draft))
      queueMicrotask(() => void runEstimate(draft));
  }, [screen.kind, draft, runEstimate]);

  // ── 7c: the affected-meals line ────────────────────────────
  useEffect(() => {
    if (screen.kind !== 'notes' || affected !== null) return;
    void countAffectedMealsAction().then((result) => {
      setAffected(result.ok ? result.data.affectedMeals : 0);
    });
  }, [screen.kind, affected]);

  // ── Navigation ─────────────────────────────────────────────
  function slotIndex(key: string) {
    return slotOrder.findIndex((s) => s.key === key);
  }

  async function afterSlot(next: PlanDraft, index: number) {
    if (index + 1 < slotOrder.length) {
      setScreen({ kind: 'slot', key: slotOrder[index + 1].key });
      return;
    }
    if (hasSummary) {
      setScreen({ kind: 'summary' });
      return;
    }
    const saved = await save('reviewed', { meals: true }, next);
    if (saved) setScreen({ kind: 'targets' });
  }

  function backFromSlot(index: number) {
    if (index > 0) setScreen({ kind: 'slot', key: slotOrder[index - 1].key });
  }

  function goBackFromTargets() {
    if (!hasSlots) return;
    estimateRan.current = false;
    if (hasSummary) setScreen({ kind: 'summary' });
    else setScreen({ kind: 'slot', key: slotOrder[slotOrder.length - 1].key });
  }

  function confirm() {
    return busy(async () => {
      const reviewed = await save('reviewed', { notes: true, targets: true, meals: true });
      if (!reviewed) return;
      const result = await confirmPlanAction({ draftRevision: reviewed.draftRevision });
      if (!result.ok) {
        if (result.code === 'CONFLICT') await reload();
        toast.error(result.error);
        return;
      }
      if (mode === 'plan') toast.success(t('plan.review.confirmed'));
      router.replace(routes.done);
      router.refresh();
    });
  }

  function discard() {
    return busy(async () => {
      const result = await discardPlanDraftAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.replace('/plan');
      router.refresh();
    });
  }

  // ── Screens ────────────────────────────────────────────────
  if (screen.kind === 'slot') {
    const index = slotIndex(screen.key);
    const slot = slotOrder[index];
    if (!slot) {
      return (
        <PlanScreen step={stepFor(ONBOARDING_STEP.MEALS)} title={t('plan.review.mealsTitle')}>
          <p className="text-sm text-muted-foreground">{t('plan.review.noDraft')}</p>
        </PlanScreen>
      );
    }
    const question = draft.questions.find((q) => q.slotKey === slot.key && !q.answered) ?? null;
    return (
      <PlanScreen
        step={stepFor(ONBOARDING_STEP.MEALS)}
        substep={{ index, count: mealScreens }}
        title={t('plan.review.mealsTitle')}
        backHref={mode === 'plan' && index === 0 ? '/plan' : undefined}
      >
        <SlotReview
          key={`${slot.key}:${draft.draftRevision}`}
          slot={slot}
          window={windows.get(slot.key) ?? null}
          question={question}
          current={index + 1}
          total={slotOrder.length}
          saving={saving}
          onBack={index > 0 ? () => backFromSlot(index) : undefined}
          onSave={(edited) =>
            busy(async () => {
              await save('slot', normalize(edited));
            })
          }
          onLooksRight={(accepted, answered) =>
            busy(async () => {
              let next = await save('slot', { ...normalize(accepted), reviewed: true });
              if (!next) return;
              if (answered) {
                const questions = next.questions.map((q) =>
                  q.key === answered.key ? { ...q, answered: true } : q,
                );
                next = await save('questions', questions, next);
                if (!next) return;
              }
              await afterSlot(next, index);
            })
          }
        />
      </PlanScreen>
    );
  }

  if (screen.kind === 'summary' && firstDay !== undefined) {
    return (
      <PlanScreen
        step={stepFor(ONBOARDING_STEP.MEALS)}
        substep={{ index: mealScreens - 1, count: mealScreens }}
        title={t('plan.review.weekdaySummaryTitle')}
      >
        <WeekdaySummary
          reviewedWeekday={firstDay}
          days={otherDays}
          saving={saving}
          onBack={() => setScreen({ kind: 'slot', key: slotOrder[slotOrder.length - 1].key })}
          onApplyAll={() =>
            busy(async () => {
              const slots: DraftSlot[] = draft.slots.map((s) => ({ ...s, reviewed: true }));
              const saved = await save('slots', slots);
              if (!saved) return;
              const done = await save('reviewed', { meals: true }, saved);
              if (done) setScreen({ kind: 'targets' });
            })
          }
          onReviewEach={() => {
            setReviewEach(true);
            const first = otherDays[0]?.slots[0];
            if (first) setScreen({ kind: 'slot', key: first.key });
          }}
        />
      </PlanScreen>
    );
  }

  if (screen.kind === 'targets') {
    return (
      <PlanScreen
        step={stepFor(ONBOARDING_STEP.TARGETS)}
        title={t('plan.review.targetsTitle')}
        backHref={mode === 'plan' && !hasSlots ? '/plan' : undefined}
      >
        <TargetsReview
          key={draft.draftRevision}
          draft={draft}
          estimate={estimate}
          estimateError={estimateError}
          saving={saving}
          onRetryEstimate={() => void runEstimate(draft)}
          onBack={hasSlots ? goBackFromTargets : undefined}
          onSave={(targets) =>
            busy(async () => {
              await save('targets', targets);
            })
          }
          onLooksRight={(targets) =>
            busy(async () => {
              let current = draft;
              if (JSON.stringify(targets) !== JSON.stringify(draft.targets)) {
                const saved = await save('targets', targets, current);
                if (!saved) return;
                current = saved;
              }
              const done = await save('reviewed', { targets: true }, current);
              if (done) setScreen({ kind: 'notes' });
            })
          }
        />
      </PlanScreen>
    );
  }

  return (
    <PlanScreen step={stepFor(ONBOARDING_STEP.NOTES)} title={t('plan.review.notesTitle')}>
      <NotesReview
        notes={draft.notes}
        affectedMeals={draftKind === 'IMPORT' && mode === 'onboarding' ? 0 : affected}
        saving={saving}
        onBack={() => setScreen({ kind: 'targets' })}
        onConfirm={confirm}
      />
      {mode === 'plan' ? (
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full"
          disabled={saving}
          onClick={discard}
        >
          {t('plan.review.discard')}
        </Button>
      ) : null}
    </PlanScreen>
  );
}

async function handle(
  result: ActionResult<PlanDraft>,
  reload: () => Promise<void>,
  setDraft: (draft: PlanDraft) => void,
): Promise<PlanDraft | null> {
  if (result.ok) {
    setDraft(result.data);
    return result.data;
  }
  if (result.code === 'CONFLICT') await reload();
  else toast.error(result.error);
  return null;
}

function needsEstimate(draft: PlanDraft): boolean {
  return draft.slots.some((slot) =>
    slot.options.some((option) =>
      option.items.some((item) => item.nutrition === null || item.needsEstimate),
    ),
  );
}
