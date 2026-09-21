'use client';

import { useState } from 'react';
import { CircleHelp, Clock } from 'lucide-react';
import { Badge, Button, FormField } from '@/components/UiComponents';
import { AmountPrefix, GramsEach } from '@/components/product/ItemAmount';
import { NameLabel } from '@/components/product/NameLabel';
import { SlotWindowText } from '@/components/product/SlotWindow';
import { Surface } from '@/components/product/Surface';
import type { SlotWindow } from '@/lib/rubric/windows';
import { t } from '@/lib/t';
import type { DraftItem, DraftQuestion, DraftSlot } from '@/lib/validations/plan';
import { QuantityInput, SlotEditor } from './SlotEditor';
import { SourceExcerpt } from './SourceExcerpt';
import { UnitSelect } from './UnitSelect';
import { hasItems } from './helpers';

/**
 * Screen 7a: one slot per screen. The slot as a list-surface card (name,
 * window with a clock — stated, or the one confirm will assume from the
 * name — and its options as rows with amounts and "Assumed" tags), the
 * source excerpt, and at most one question for a calorie-significant
 * unknown as a note surface. "Fix" opens the inline editor with compact
 * item rows; its time fields are the way to replace an assumed window.
 */
export function SlotReview({
  slot,
  window,
  question,
  current,
  total,
  saving,
  onLooksRight,
  onSave,
  onBack,
}: {
  slot: DraftSlot;
  /** The window confirm will write for this slot, from the whole day's names. */
  window: SlotWindow | null;
  /** The first unanswered question for this slot, if any. */
  question: DraftQuestion | null;
  current: number;
  total: number;
  saving: boolean;
  /** Called with the slot (and the answered question, if any) when the user accepts it. */
  onLooksRight: (slot: DraftSlot, answered: DraftQuestion | null) => void;
  /** "Fix" → Save changes. */
  onSave: (slot: DraftSlot) => void;
  onBack?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(slot);
  const item = questionItem(slot, question);
  const [answer, setAnswer] = useState<Answer>({
    quantity: item?.quantity ?? null,
    unit: item?.unit ?? null,
    unitGrams: item?.unitGrams ?? null,
  });

  const canSave = draft.originalName.trim() !== '' && hasItems(draft);

  function accept() {
    if (!question) return onLooksRight(slot, null);
    const next = applyAnswer(slot, question, answer);
    onLooksRight(next, question);
  }

  if (editing) {
    return (
      <div className="space-y-5">
        <SlotEditor slot={draft} onChange={setDraft} showTimes compactItems />
        <div className="grid gap-3">
          <Button
            type="button"
            className="w-full"
            loading={saving}
            disabled={!canSave}
            // The parent remounts this screen on the new revision; a failed save keeps the edits.
            onClick={() => onSave(normalize(draft))}
          >
            {t('plan.review.save')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={saving}
            onClick={() => {
              setDraft(slot);
              setEditing(false);
            }}
          >
            {t('plan.review.cancelEdit')}
          </Button>
        </div>
      </div>
    );
  }

  const multiple = slot.options.length > 1;

  return (
    <div className="space-y-5">
      <p className="text-xs font-medium text-muted-foreground">
        {t('plan.review.slotProgress', { current, total })}
      </p>
      <Surface variant="list" data-testid="review-slot-card">
        <div className="space-y-1 px-3 py-3">
          <NameLabel originalName={slot.originalName} englishLabel={slot.englishLabel} size="lg" />
          {window ? (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              <SlotWindowText window={window} />
            </p>
          ) : null}
          {window?.assumed ? (
            <p className="text-xs text-muted-foreground" data-testid="window-assumed-hint">
              {t('plan.time.assumedHint')}
            </p>
          ) : null}
        </div>
        <ol className="divide-y divide-border" aria-label={t('plan.review.mealsTitle')}>
          {slot.options.map((option, index) => (
            <li key={option.key}>
              {multiple ? (
                <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                  {t('plan.option.n', { n: index + 1 })}
                </p>
              ) : null}
              <ul className="divide-y divide-border/60">
                {option.items.map((it) => (
                  <ItemRow key={it.key} item={it} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Surface>
      <SourceExcerpt text={slot.sourceExcerpt} />
      {question && item ? (
        <Surface variant="note" className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CircleHelp className="size-4" aria-hidden="true" />
            {t('plan.review.question')}
          </p>
          <p className="text-base">
            <bdi>{question.question}</bdi>
          </p>
          <NameLabel originalName={item.originalName} englishLabel={item.englishLabel} size="sm" />
          <div className="grid grid-cols-[1fr_1.4fr] gap-3">
            <FormField label={t('plan.review.quantity')}>
              <QuantityInput
                value={answer.quantity}
                onChange={(quantity) => setAnswer((a) => ({ ...a, quantity }))}
              />
            </FormField>
            <FormField label={t('plan.review.unit')}>
              <UnitSelect
                ariaLabel={t('plan.review.unit')}
                value={answer.unit}
                unitGrams={answer.unitGrams}
                onChange={(unit) => setAnswer((a) => ({ ...a, unit, unitGrams: null }))}
                onUnitGramsChange={(unitGrams) => setAnswer((a) => ({ ...a, unitGrams }))}
              />
            </FormField>
          </div>
          <p className="text-xs text-muted-foreground">{t('plan.review.questionHint')}</p>
        </Surface>
      ) : null}
      <ReviewActions
        primary={t('plan.review.looksRight')}
        saving={saving}
        onPrimary={accept}
        onBack={onBack}
        secondary={t('plan.review.fix')}
        onSecondary={() => {
          setDraft(slot);
          setEditing(true);
        }}
      />
    </div>
  );
}

/**
 * The action block every review screen ends with: the one filled primary,
 * then Back (ghost) and an optional outline secondary side by side.
 */
export function ReviewActions({
  primary,
  saving,
  disabled = false,
  onPrimary,
  onBack,
  secondary,
  onSecondary,
  primaryTestId,
}: {
  primary: string;
  saving: boolean;
  disabled?: boolean;
  onPrimary: () => void;
  onBack?: () => void;
  secondary?: string;
  onSecondary?: () => void;
  primaryTestId?: string;
}) {
  const row = [onBack, secondary].filter(Boolean).length;
  return (
    <div className="grid gap-3">
      <Button
        type="button"
        className="w-full"
        loading={saving}
        disabled={disabled}
        onClick={onPrimary}
        data-testid={primaryTestId}
      >
        {primary}
      </Button>
      {row > 0 ? (
        <div className={row === 2 ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={saving}
              onClick={onBack}
            >
              {t('plan.review.back')}
            </Button>
          ) : null}
          {secondary ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={saving || disabled}
              onClick={onSecondary}
            >
              {secondary}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** One prescribed item: the amount before the name ("2 × سیب", "150 g · مرغ"), grams each for counts. */
function ItemRow({ item }: { item: DraftItem }) {
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <AmountPrefix quantity={item.quantity} unit={item.unit} className="text-sm" />
          <NameLabel originalName={item.originalName} englishLabel={item.englishLabel} size="sm" />
        </div>
        <GramsEach unit={item.unit} unitGrams={item.unitGrams} className="block" />
        {item.alternatives.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('plan.item.alternatives', {
              names: item.alternatives.map((a) => a.originalName).join(' / '),
            })}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-end text-muted-foreground">
        {item.quantity === null ? <span>{t('plan.item.noQuantity')}</span> : null}
        {item.quantityAssumed ? (
          <Badge variant="outline" title={t('plan.assumedHint')}>
            {t('plan.assumed')}
          </Badge>
        ) : null}
      </div>
    </li>
  );
}

function questionItem(slot: DraftSlot, question: DraftQuestion | null): DraftItem | null {
  if (!question) return null;
  for (const option of slot.options)
    for (const item of option.items) if (item.key === question.itemKey) return item;
  return null;
}

interface Answer {
  quantity: number | null;
  unit: string | null;
  unitGrams: number | null;
}

function applyAnswer(slot: DraftSlot, question: DraftQuestion, answer: Answer): DraftSlot {
  return {
    ...slot,
    options: slot.options.map((option) => ({
      ...option,
      items: option.items.map((item) =>
        item.key === question.itemKey
          ? {
              ...item,
              quantity: answer.quantity,
              unit: answer.unit,
              unitGrams: answer.unitGrams,
              quantityAssumed: false,
              needsEstimate: true,
            }
          : item,
      ),
    })),
  };
}

/** Empty English labels fall back to the original so NameLabel always has both. */
export function normalize(slot: DraftSlot): DraftSlot {
  return {
    ...slot,
    originalName: slot.originalName.trim(),
    englishLabel: slot.englishLabel.trim() || slot.originalName.trim(),
    options: slot.options.map((option, oi) => ({
      ...option,
      position: oi,
      items: option.items.map((item, ii) => ({
        ...item,
        position: ii,
        originalName: item.originalName.trim(),
        englishLabel: item.englishLabel.trim() || item.originalName.trim(),
      })),
    })),
  };
}
