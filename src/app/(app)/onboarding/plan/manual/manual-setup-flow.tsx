'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import {
  getPlanDraftAction,
  startManualPlanAction,
  updatePlanDraftAction,
} from '@/actions/plan.actions';
import { NameLabel } from '@/components/product/NameLabel';
import {
  QuantityInput,
  SlotEditor,
  newItem,
  newSlot,
} from '@/components/product/plan-review/SlotEditor';
import { normalize } from '@/components/product/plan-review/SlotReview';
import {
  AddTargetButton,
  TargetFields,
  newTarget,
  targetComplete,
} from '@/components/product/plan-review/TargetFields';
import { newKey, weekdayName } from '@/components/product/plan-review/helpers';
import {
  Button,
  FormField,
  Input,
  RadioGroup,
  RadioGroupItem,
  Textarea,
  toast,
} from '@/components/UiComponents';
import { t } from '@/lib/t';
import { isValidLocalTime } from '@/lib/time';
import {
  EVERY_DAY,
  PLAN_STRUCTURES,
  type DraftRule,
  type DraftSection,
  type DraftSlot,
  type DraftTarget,
  type PlanDraft,
} from '@/lib/validations/plan';
import { PlanScreen, planRoutes, type PlanFlowMode } from '../plan-screen';
import { MANUAL_REVIEW_STEP, isManualStep, type ManualStep } from './steps';

type Structure = PlanDraft['structure'];

type Screen =
  | { kind: 'structure' }
  | { kind: 'name' }
  | { kind: 'day' }
  | { kind: 'slots'; weekday: number }
  | { kind: 'items'; slotKey: string }
  | { kind: 'times' }
  | { kind: 'ranges' }
  | { kind: 'targets' }
  | { kind: 'rules' }
  | { kind: 'source' };

/** Saturday first (product spec § 6 default week start). */
const WEEK = [6, 0, 1, 2, 3, 4, 5];

/**
 * Manual plan setup (design-scope screen 2 "Manual setup"): structure → name
 * → only what that structure needs, one thing per screen. Every screen
 * writes one draft section and its progress (`manualStep`), then hands over
 * to the review flow.
 */
export function ManualSetupFlow({
  mode,
  initialDraft,
}: {
  mode: PlanFlowMode;
  initialDraft: PlanDraft | null;
}) {
  const router = useRouter();
  const routes = planRoutes(mode);
  const step = mode === 'onboarding' ? 7 : undefined;
  const [draft, setDraft] = useState<PlanDraft | null>(initialDraft);
  const [structure, setStructure] = useState<Structure>(
    initialDraft?.structure ?? 'SAME_EVERY_DAY',
  );
  const [saving, setSaving] = useState(false);
  const [screen, setScreen] = useState<Screen>(() => resumeScreen(initialDraft));

  const reload = useCallback(async () => {
    const result = await getPlanDraftAction();
    if (result.ok && result.data) {
      setDraft(result.data);
      setScreen(resumeScreen(result.data));
      toast.error(t('plan.review.conflictReloaded'));
    }
  }, []);

  async function save(section: DraftSection, payload: unknown, from: PlanDraft) {
    const result = await updatePlanDraftAction({
      draftRevision: from.draftRevision,
      section,
      payload,
    });
    if (result.ok) {
      setDraft(result.data);
      return result.data;
    }
    if (result.code === 'CONFLICT') await reload();
    else toast.error(result.error);
    return null;
  }

  /** Writes one section, records progress, and moves to the next screen. */
  function advance(
    section: DraftSection | null,
    payload: unknown,
    stepName: ManualStep,
    next: Screen | ((saved: PlanDraft) => Screen),
  ) {
    if (!draft) return;
    setSaving(true);
    void (async () => {
      try {
        let current: PlanDraft | null = draft;
        if (section) current = await save(section, payload, current);
        if (!current) return;
        if (current.manualStep !== stepName) current = await save('manualStep', stepName, current);
        if (!current) return;
        if (stepName === MANUAL_REVIEW_STEP) {
          router.replace(routes.review);
          router.refresh();
          return;
        }
        setScreen(typeof next === 'function' ? next(current) : next);
      } finally {
        setSaving(false);
      }
    })();
  }

  // A slot removed elsewhere leaves an items screen pointing nowhere: resume instead.
  const view: Screen =
    screen.kind === 'items' && !draft?.slots.some((s) => s.key === screen.slotKey)
      ? resumeScreen(draft)
      : screen;

  // ── Before a draft exists ──────────────────────────────────
  if (view.kind === 'structure' && !draft) {
    return (
      <PlanScreen step={step} title={t('plan.manual.structureTitle')} backHref={routes.add}>
        <RadioGroup
          value={structure}
          onValueChange={(v) => setStructure(v as Structure)}
          className="grid gap-3"
          aria-label={t('plan.manual.structureTitle')}
        >
          {PLAN_STRUCTURES.map((option) => (
            <label
              key={option}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-accent has-[[data-state=checked]]:border-primary"
            >
              <RadioGroupItem value={option} />
              <span className="flex flex-col">
                <span className="text-base font-medium">{t(`plan.structure.${option}`)}</span>
                <span className="text-xs text-muted-foreground">
                  {t(`plan.structure.${option}.hint`)}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
        <Button type="button" className="h-11 w-full" onClick={() => setScreen({ kind: 'name' })}>
          {t('plan.manual.continue')}
        </Button>
      </PlanScreen>
    );
  }

  if (view.kind === 'name') {
    return (
      <NameScreen
        step={step}
        saving={saving}
        initial={draft?.name ?? ''}
        onBack={draft ? undefined : () => setScreen({ kind: 'structure' })}
        onSave={(name) => {
          setSaving(true);
          void (async () => {
            try {
              // Renaming an existing draft keeps its slots; only the first visit creates one.
              let created: PlanDraft | null = draft;
              if (created) created = await save('meta', { name }, created);
              else {
                const result = await startManualPlanAction({ structure, name: name ?? undefined });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                created = result.data;
              }
              if (!created) return;
              const first: ManualStep =
                created.structure === 'TARGETS_ONLY'
                  ? 'targets'
                  : created.structure === 'BY_WEEKDAY'
                    ? 'day'
                    : 'slots';
              const saved =
                created.manualStep === null ? await save('manualStep', first, created) : created;
              if (saved) setScreen(firstScreen(first));
            } finally {
              setSaving(false);
            }
          })();
        }}
      />
    );
  }

  if (!draft) return null;

  // ── Weekday plans: pick the day ────────────────────────────
  if (view.kind === 'day') {
    const daysDone = new Set(draft.slots.map((s) => s.weekday));
    return (
      <PlanScreen
        step={step}
        title={t('plan.manual.dayTitle')}
        onBack={() => setScreen({ kind: 'name' })}
      >
        <p className="text-sm text-muted-foreground">{t('plan.manual.dayHint')}</p>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {WEEK.map((weekday) => (
            <li
              key={weekday}
              className="flex min-h-11 items-center justify-between gap-3 px-4 py-2"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {daysDone.has(weekday) ? (
                  <Check className="size-4 text-success" aria-hidden="true" />
                ) : null}
                {weekdayName(weekday)}
              </span>
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                onClick={() => setScreen({ kind: 'slots', weekday })}
              >
                {t('plan.manual.daySetUp')}
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          className="h-11 w-full"
          disabled={daysDone.size === 0}
          loading={saving}
          onClick={() => advance(null, null, 'times', { kind: 'times' })}
        >
          {t('plan.manual.dayDone')}
        </Button>
      </PlanScreen>
    );
  }

  // ── Slots in order ─────────────────────────────────────────
  if (view.kind === 'slots') {
    const weekday = view.weekday;
    return (
      <SlotsScreen
        key={weekday}
        step={step}
        weekday={weekday}
        byWeekday={structure === 'BY_WEEKDAY'}
        existing={draft.slots.filter((s) => s.weekday === weekday)}
        saving={saving}
        onBack={() => setScreen(structure === 'BY_WEEKDAY' ? { kind: 'day' } : { kind: 'name' })}
        onSave={(daySlots) => {
          const others = draft.slots.filter((s) => s.weekday !== weekday);
          const slots = [...others, ...daySlots];
          advance('slots', slots, 'items', { kind: 'items', slotKey: daySlots[0].key });
        }}
      />
    );
  }

  // ── Items per slot ─────────────────────────────────────────
  if (view.kind === 'items') {
    const slot = draft.slots.find((s) => s.key === view.slotKey);
    if (!slot) return null;
    const daySlots = draft.slots
      .filter((s) => s.weekday === slot.weekday)
      .sort((a, b) => a.position - b.position);
    const index = daySlots.findIndex((s) => s.key === slot.key);
    const nextSlot = daySlots[index + 1];
    return (
      <ItemsScreen
        key={slot.key}
        step={step}
        slot={slot}
        saving={saving}
        onBack={() =>
          index > 0
            ? setScreen({ kind: 'items', slotKey: daySlots[index - 1].key })
            : setScreen({ kind: 'slots', weekday: slot.weekday })
        }
        onSave={(edited) => {
          if (nextSlot) advance('slot', edited, 'items', { kind: 'items', slotKey: nextSlot.key });
          else if (structure === 'BY_WEEKDAY') advance('slot', edited, 'day', { kind: 'day' });
          else advance('slot', edited, 'times', { kind: 'times' });
        }}
      />
    );
  }

  const orderedSlots = [...draft.slots].sort(
    (a, b) => a.weekday - b.weekday || a.position - b.position,
  );

  if (view.kind === 'times') {
    return (
      <TimesScreen
        step={step}
        slots={orderedSlots}
        byWeekday={structure === 'BY_WEEKDAY'}
        saving={saving}
        onBack={() =>
          setScreen(
            structure === 'BY_WEEKDAY'
              ? { kind: 'day' }
              : { kind: 'items', slotKey: orderedSlots[orderedSlots.length - 1]?.key ?? '' },
          )
        }
        onSave={(slots) => advance('slots', slots, 'ranges', { kind: 'ranges' })}
      />
    );
  }

  if (view.kind === 'ranges') {
    return (
      <RangesScreen
        step={step}
        slots={orderedSlots}
        byWeekday={structure === 'BY_WEEKDAY'}
        targets={draft.targets}
        saving={saving}
        onBack={() => setScreen({ kind: 'times' })}
        onSave={(targets) => advance('targets', targets, 'targets', { kind: 'targets' })}
      />
    );
  }

  if (view.kind === 'targets') {
    return (
      <TargetsScreen
        step={step}
        targets={draft.targets}
        required={structure === 'TARGETS_ONLY'}
        saving={saving}
        onBack={() =>
          setScreen(structure === 'TARGETS_ONLY' ? { kind: 'name' } : { kind: 'ranges' })
        }
        onSave={(targets) =>
          structure === 'TARGETS_ONLY'
            ? advance('targets', targets, MANUAL_REVIEW_STEP, { kind: 'targets' })
            : advance('targets', targets, 'rules', { kind: 'rules' })
        }
      />
    );
  }

  if (view.kind === 'rules') {
    return (
      <RulesScreen
        step={step}
        rules={draft.rules}
        saving={saving}
        onBack={() => setScreen({ kind: 'targets' })}
        onSave={(rules) => advance('rules', rules, 'source', { kind: 'source' })}
      />
    );
  }

  return (
    <PlanScreen
      step={step}
      title={t('plan.manual.sourceTitle')}
      onBack={() => setScreen({ kind: 'rules' })}
    >
      <SourceForm
        initial={draft.sourceNote ?? ''}
        saving={saving}
        onSave={(sourceNote) =>
          advance('meta', { sourceNote }, MANUAL_REVIEW_STEP, { kind: 'source' })
        }
      />
    </PlanScreen>
  );
}

// ─── Resume ─────────────────────────────────────────────────────────────────

function firstScreen(stepName: ManualStep): Screen {
  switch (stepName) {
    case 'day':
      return { kind: 'day' };
    case 'slots':
      return { kind: 'slots', weekday: EVERY_DAY };
    case 'times':
      return { kind: 'times' };
    case 'ranges':
      return { kind: 'ranges' };
    case 'targets':
      return { kind: 'targets' };
    case 'rules':
      return { kind: 'rules' };
    case 'source':
      return { kind: 'source' };
    default:
      return { kind: 'targets' };
  }
}

function resumeScreen(draft: PlanDraft | null): Screen {
  if (!draft) return { kind: 'structure' };
  const stepName = isManualStep(draft.manualStep) ? draft.manualStep : null;
  if (!stepName) {
    if (draft.structure === 'TARGETS_ONLY') return { kind: 'targets' };
    return draft.structure === 'BY_WEEKDAY'
      ? { kind: 'day' }
      : { kind: 'slots', weekday: EVERY_DAY };
  }
  if (stepName === 'items') {
    const pending = draft.slots.find((s) =>
      s.options.every((o) => o.items.every((i) => i.originalName.trim() === '')),
    );
    if (pending) return { kind: 'items', slotKey: pending.key };
    return draft.structure === 'BY_WEEKDAY' ? { kind: 'day' } : { kind: 'times' };
  }
  if (stepName === 'slots' && draft.structure === 'BY_WEEKDAY') return { kind: 'day' };
  return firstScreen(stepName);
}

// ─── Screens ────────────────────────────────────────────────────────────────

function NameScreen({
  step,
  initial,
  saving,
  onBack,
  onSave,
}: {
  step?: number;
  initial: string;
  saving: boolean;
  onBack?: () => void;
  onSave: (name: string | null) => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <PlanScreen step={step} title={t('plan.manual.nameTitle')} onBack={onBack}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name.trim() || null);
        }}
      >
        <FormField label={t('plan.manual.nameLabel')} helperText={t('plan.manual.nameHint')}>
          <Input
            dir="auto"
            autoFocus
            maxLength={200}
            className="h-11 text-lg"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <Button type="submit" className="h-11 w-full" loading={saving}>
          {t('plan.manual.continue')}
        </Button>
      </form>
    </PlanScreen>
  );
}

function SlotsScreen({
  step,
  weekday,
  byWeekday,
  existing,
  saving,
  onBack,
  onSave,
}: {
  step?: number;
  weekday: number;
  byWeekday: boolean;
  existing: DraftSlot[];
  saving: boolean;
  onBack: () => void;
  onSave: (slots: DraftSlot[]) => void;
}) {
  const [slots, setSlots] = useState<DraftSlot[]>(
    existing.length > 0
      ? [...existing].sort((a, b) => a.position - b.position)
      : [newSlot(weekday, 0)],
  );
  const valid = slots.length > 0 && slots.every((s) => s.originalName.trim() !== '');
  function update(index: number, patch: Partial<DraftSlot>) {
    setSlots((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  return (
    <PlanScreen
      step={step}
      title={
        byWeekday
          ? t('plan.manual.slotsTitleDay', { day: weekdayName(weekday) })
          : t('plan.manual.slotsTitle')
      }
      onBack={onBack}
    >
      <p className="text-sm text-muted-foreground">{t('plan.manual.slotsHint')}</p>
      <ol className="space-y-3">
        {slots.map((slot, index) => (
          <li key={slot.key} className="flex items-end gap-2">
            <FormField className="flex-1" label={t('plan.manual.slotName', { n: index + 1 })}>
              <Input
                dir="auto"
                className="h-11"
                maxLength={200}
                value={slot.originalName}
                onChange={(e) => update(index, { originalName: e.target.value })}
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0"
              aria-label={t('plan.manual.removeSlot')}
              disabled={slots.length <= 1}
              onClick={() =>
                setSlots((list) =>
                  list.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i })),
                )
              }
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        onClick={() => setSlots((list) => [...list, newSlot(weekday, list.length)])}
      >
        <Plus className="size-4" aria-hidden="true" />
        {t('plan.manual.addSlot')}
      </Button>
      {!valid ? (
        <p className="text-sm text-muted-foreground">{t('plan.manual.slotRequired')}</p>
      ) : null}
      <Button
        type="button"
        className="h-11 w-full"
        loading={saving}
        disabled={!valid}
        onClick={() =>
          onSave(
            slots.map((s, i) => ({
              ...s,
              position: i,
              originalName: s.originalName.trim(),
              englishLabel: s.englishLabel.trim() || s.originalName.trim(),
            })),
          )
        }
      >
        {t('plan.manual.continue')}
      </Button>
    </PlanScreen>
  );
}

function ItemsScreen({
  step,
  slot,
  saving,
  onBack,
  onSave,
}: {
  step?: number;
  slot: DraftSlot;
  saving: boolean;
  onBack: () => void;
  onSave: (slot: DraftSlot) => void;
}) {
  const [edited, setEdited] = useState<DraftSlot>(() => ({
    ...slot,
    options: slot.options.map((o) => (o.items.length === 0 ? { ...o, items: [newItem(0)] } : o)),
  }));
  const valid = edited.options.every(
    (o) => o.items.length > 0 && o.items.every((i) => i.originalName.trim() !== ''),
  );
  return (
    <PlanScreen
      step={step}
      title={t('plan.manual.itemsTitle', { slot: `\u2068${slot.originalName}\u2069` })}
      onBack={onBack}
    >
      <p className="text-sm text-muted-foreground">{t('plan.manual.itemsHint')}</p>
      <SlotEditor slot={edited} onChange={setEdited} showNames={false} />
      {!valid ? (
        <p className="text-sm text-muted-foreground">{t('plan.manual.itemRequired')}</p>
      ) : null}
      <Button
        type="button"
        className="h-11 w-full"
        loading={saving}
        disabled={!valid}
        onClick={() => onSave(normalize(edited))}
      >
        {t('plan.manual.continue')}
      </Button>
    </PlanScreen>
  );
}

function SlotLabel({ slot, byWeekday }: { slot: DraftSlot; byWeekday: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <NameLabel
        originalName={slot.originalName}
        englishLabel={slot.englishLabel}
        size="sm"
        inline
      />
      {byWeekday ? (
        <span className="text-xs text-muted-foreground">{weekdayName(slot.weekday, 'short')}</span>
      ) : null}
    </div>
  );
}

function TimesScreen({
  step,
  slots,
  byWeekday,
  saving,
  onBack,
  onSave,
}: {
  step?: number;
  slots: DraftSlot[];
  byWeekday: boolean;
  saving: boolean;
  onBack: () => void;
  onSave: (slots: DraftSlot[]) => void;
}) {
  const [times, setTimes] = useState<Record<string, { start: string; end: string }>>(() =>
    Object.fromEntries(
      slots.map((s) => [s.key, { start: s.timeStart ?? '', end: s.timeEnd ?? '' }]),
    ),
  );
  const invalid = Object.values(times).some(
    (v) => (v.start && !isValidLocalTime(v.start)) || (v.end && !isValidLocalTime(v.end)),
  );
  function set(key: string, patch: Partial<{ start: string; end: string }>) {
    setTimes((all) => ({ ...all, [key]: { ...all[key], ...patch } }));
  }
  const apply = () =>
    onSave(
      slots.map((s) => ({
        ...s,
        timeStart: times[s.key]?.start || null,
        timeEnd: times[s.key]?.end || null,
      })),
    );
  return (
    <PlanScreen step={step} title={t('plan.manual.timesTitle')} onBack={onBack}>
      <p className="text-sm text-muted-foreground">{t('plan.manual.timesHint')}</p>
      <ul className="space-y-3">
        {slots.map((slot) => (
          <li key={slot.key} className="space-y-2 rounded-xl border border-border bg-card p-4">
            <SlotLabel slot={slot} byWeekday={byWeekday} />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label={t('plan.review.timeStart')}
                error={
                  times[slot.key]?.start && !isValidLocalTime(times[slot.key].start)
                    ? t('plan.manual.timeInvalid')
                    : undefined
                }
              >
                <Input
                  inputMode="numeric"
                  dir="auto"
                  className="h-11"
                  placeholder="08:00"
                  value={times[slot.key]?.start ?? ''}
                  onChange={(e) => set(slot.key, { start: e.target.value })}
                />
              </FormField>
              <FormField
                label={t('plan.review.timeEnd')}
                error={
                  times[slot.key]?.end && !isValidLocalTime(times[slot.key].end)
                    ? t('plan.manual.timeInvalid')
                    : undefined
                }
              >
                <Input
                  inputMode="numeric"
                  dir="auto"
                  className="h-11"
                  placeholder="09:00"
                  value={times[slot.key]?.end ?? ''}
                  onChange={(e) => set(slot.key, { end: e.target.value })}
                />
              </FormField>
            </div>
          </li>
        ))}
      </ul>
      <ContinueSkip
        saving={saving}
        disabled={invalid}
        onContinue={apply}
        onSkip={() => onSave(slots)}
      />
    </PlanScreen>
  );
}

function RangesScreen({
  step,
  slots,
  byWeekday,
  targets,
  saving,
  onBack,
  onSave,
}: {
  step?: number;
  slots: DraftSlot[];
  byWeekday: boolean;
  targets: DraftTarget[];
  saving: boolean;
  onBack: () => void;
  onSave: (targets: DraftTarget[]) => void;
}) {
  const existing = (key: string) =>
    targets.find((x) => x.slotKey === key && x.nutrient === 'ENERGY_KCAL');
  const [ranges, setRanges] = useState<Record<string, { low: number | null; high: number | null }>>(
    () =>
      Object.fromEntries(
        slots.map((s) => {
          const target = existing(s.key);
          return [s.key, { low: target?.low ?? null, high: target?.high ?? null }];
        }),
      ),
  );
  const invalid = Object.values(ranges).some(
    (r) =>
      (r.low === null) !== (r.high === null) ||
      (r.low !== null && r.high !== null && r.low > r.high),
  );
  function apply() {
    const kept = targets.filter((x) => !(x.slotKey !== null && x.nutrient === 'ENERGY_KCAL'));
    const perMeal: DraftTarget[] = slots.flatMap((s) => {
      const r = ranges[s.key];
      if (!r || r.low === null || r.high === null) return [];
      const previous = existing(s.key);
      return [
        {
          key: previous?.key ?? newKey(),
          slotKey: s.key,
          weekday: byWeekday ? s.weekday : null,
          nutrient: 'ENERGY_KCAL',
          type: 'RANGE',
          low: r.low,
          high: r.high,
          source: 'EXPLICIT',
          sourceExcerpt: null,
        },
      ];
    });
    onSave([...kept, ...perMeal]);
  }
  return (
    <PlanScreen step={step} title={t('plan.manual.rangesTitle')} onBack={onBack}>
      <p className="text-sm text-muted-foreground">{t('plan.manual.rangesHint')}</p>
      <ul className="space-y-3">
        {slots.map((slot) => (
          <li key={slot.key} className="space-y-2 rounded-xl border border-border bg-card p-4">
            <SlotLabel slot={slot} byWeekday={byWeekday} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label={`${t('plan.target.low')} (${t('plan.unit.kcal')})`}>
                <QuantityInput
                  value={ranges[slot.key]?.low ?? null}
                  onChange={(low) =>
                    setRanges((all) => ({ ...all, [slot.key]: { ...all[slot.key], low } }))
                  }
                />
              </FormField>
              <FormField
                label={`${t('plan.target.high')} (${t('plan.unit.kcal')})`}
                error={
                  ranges[slot.key] &&
                  ((ranges[slot.key].low === null) !== (ranges[slot.key].high === null) ||
                    (ranges[slot.key].low ?? 0) > (ranges[slot.key].high ?? Infinity))
                    ? t('validation.targetRange')
                    : undefined
                }
              >
                <QuantityInput
                  value={ranges[slot.key]?.high ?? null}
                  onChange={(high) =>
                    setRanges((all) => ({ ...all, [slot.key]: { ...all[slot.key], high } }))
                  }
                />
              </FormField>
            </div>
          </li>
        ))}
      </ul>
      <ContinueSkip
        saving={saving}
        disabled={invalid}
        onContinue={apply}
        onSkip={() => onSave(targets)}
      />
    </PlanScreen>
  );
}

function TargetsScreen({
  step,
  targets,
  required,
  saving,
  onBack,
  onSave,
}: {
  step?: number;
  targets: DraftTarget[];
  required: boolean;
  saving: boolean;
  onBack: () => void;
  onSave: (targets: DraftTarget[]) => void;
}) {
  const daily = targets.filter((x) => x.slotKey === null);
  const others = targets.filter((x) => x.slotKey !== null);
  const [list, setList] = useState<DraftTarget[]>(
    daily.length > 0 || !required ? daily : [newTarget()],
  );
  const complete = list.every(targetComplete) && (!required || list.length > 0);
  return (
    <PlanScreen step={step} title={t('plan.manual.targetsTitle')} onBack={onBack}>
      <p className="text-sm text-muted-foreground">
        {required ? t('plan.manual.targetsRequired') : t('plan.manual.targetsHint')}
      </p>
      {list.map((target) => (
        <TargetFields
          key={target.key}
          target={target}
          onChange={(next) => setList((all) => all.map((x) => (x.key === next.key ? next : x)))}
          onRemove={() => setList((all) => all.filter((x) => x.key !== target.key))}
        />
      ))}
      <AddTargetButton onAdd={() => setList((all) => [...all, newTarget()])} />
      <ContinueSkip
        saving={saving}
        disabled={!complete}
        onContinue={() => onSave([...others, ...list])}
        onSkip={required ? undefined : () => onSave(others)}
        continueLabel={required ? t('plan.manual.review') : undefined}
      />
    </PlanScreen>
  );
}

function RulesScreen({
  step,
  rules,
  saving,
  onBack,
  onSave,
}: {
  step?: number;
  rules: DraftRule[];
  saving: boolean;
  onBack: () => void;
  onSave: (rules: DraftRule[]) => void;
}) {
  const [list, setList] = useState<DraftRule[]>(rules.length > 0 ? rules : [blankRule()]);
  function apply() {
    onSave(
      list
        .filter((r) => r.originalText.trim() !== '')
        .map((r) => ({
          ...r,
          originalText: r.originalText.trim(),
          sourceExcerpt: r.originalText.trim(),
        })),
    );
  }
  return (
    <PlanScreen step={step} title={t('plan.manual.rulesTitle')} onBack={onBack}>
      <p className="text-sm text-muted-foreground">{t('plan.manual.rulesHint')}</p>
      {list.map((rule, index) => (
        <div key={rule.key} className="flex items-end gap-2">
          <FormField className="flex-1" label={t('plan.manual.ruleLabel', { n: index + 1 })}>
            <Textarea
              dir="auto"
              rows={2}
              maxLength={2000}
              value={rule.originalText}
              onChange={(e) =>
                setList((all) =>
                  all.map((r) => (r.key === rule.key ? { ...r, originalText: e.target.value } : r)),
                )
              }
            />
          </FormField>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label={t('plan.manual.removeRule')}
            disabled={list.length <= 1}
            onClick={() => setList((all) => all.filter((r) => r.key !== rule.key))}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        onClick={() => setList((all) => [...all, blankRule()])}
      >
        <Plus className="size-4" aria-hidden="true" />
        {t('plan.manual.addRule')}
      </Button>
      <ContinueSkip saving={saving} onContinue={apply} onSkip={() => onSave(rules)} />
    </PlanScreen>
  );
}

function blankRule(): DraftRule {
  return {
    key: newKey(),
    kind: 'INSTRUCTION',
    tracking: 'NOTE',
    period: null,
    definition: {},
    originalText: '',
    sourceExcerpt: '',
    isConflicting: false,
    unsupportedReason: null,
  };
}

function SourceForm({
  initial,
  saving,
  onSave,
}: {
  initial: string;
  saving: boolean;
  onSave: (sourceNote: string | null) => void;
}) {
  const [note, setNote] = useState(initial);
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(note.trim() || null);
      }}
    >
      <FormField label={t('plan.manual.sourceLabel')} helperText={t('plan.manual.sourceHint')}>
        <Input
          dir="auto"
          maxLength={200}
          className="h-11"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </FormField>
      <Button type="submit" className="h-11 w-full" loading={saving}>
        {t('plan.manual.review')}
      </Button>
    </form>
  );
}

function ContinueSkip({
  saving,
  disabled,
  onContinue,
  onSkip,
  continueLabel,
}: {
  saving: boolean;
  disabled?: boolean;
  onContinue: () => void;
  onSkip?: () => void;
  continueLabel?: string;
}) {
  return (
    <div className="grid gap-3">
      <Button
        type="button"
        className="h-11 w-full"
        loading={saving}
        disabled={disabled}
        onClick={onContinue}
      >
        {continueLabel ?? t('plan.manual.continue')}
      </Button>
      {onSkip ? (
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full"
          disabled={saving}
          onClick={onSkip}
        >
          {t('plan.manual.skip')}
        </Button>
      ) : null}
    </div>
  );
}
