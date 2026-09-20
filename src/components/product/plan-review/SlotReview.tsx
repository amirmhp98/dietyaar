'use client';

import { useState } from 'react';
import { Badge, Button, FormField } from '@/components/UiComponents';
import { AmountPrefix, GramsEach } from '@/components/product/ItemAmount';
import { NameLabel } from '@/components/product/NameLabel';
import { t } from '@/lib/t';
import type { DraftItem, DraftQuestion, DraftSlot } from '@/lib/validations/plan';
import { QuantityInput, SlotEditor } from './SlotEditor';
import { SourceExcerpt } from './SourceExcerpt';
import { UnitSelect } from './UnitSelect';

/**
 * Screen 8a: one slot per screen. Source excerpt, the slot's name, its
 * options as a compact list with amounts and "Assumed" tags, and at most one
 * question for a calorie-significant unknown. "Fix" opens the inline editor.
 */
export function SlotReview({
  slot,
  question,
  current,
  total,
  saving,
  onLooksRight,
  onSave,
  onBack,
}: {
  slot: DraftSlot;
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
  const [answer, setAnswer] = useState<Answer>(() => {
    const item = questionItem(slot, question);
    return {
      quantity: item?.quantity ?? null,
      unit: item?.unit ?? null,
      unitGrams: item?.unitGrams ?? null,
    };
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
        <SlotEditor slot={draft} onChange={setDraft} showTimes />
        <div className="grid gap-3">
          <Button
            type="button"
            className="h-11 w-full"
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
            className="h-11 w-full"
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

  const item = questionItem(slot, question);

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        {t('plan.review.slotProgress', { current, total })}
      </p>
      <div className="space-y-1">
        <NameLabel originalName={slot.originalName} englishLabel={slot.englishLabel} size="lg" />
        {slot.timeStart ? (
          <p className="text-sm text-muted-foreground" dir="ltr">
            {slot.timeEnd
              ? t('plan.time.range', { start: slot.timeStart, end: slot.timeEnd })
              : slot.timeStart}
          </p>
        ) : null}
      </div>
      <SourceExcerpt text={slot.sourceExcerpt} />
      <ol className="space-y-3" aria-label={t('plan.review.mealsTitle')}>
        {slot.options.map((option, index) => (
          <li key={option.key} className="rounded-xl border border-border bg-card p-4">
            {slot.options.length > 1 ? (
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t('plan.option.n', { n: index + 1 })}
              </p>
            ) : null}
            <ul className="space-y-2">
              {option.items.map((it) => (
                <ItemRow key={it.key} item={it} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {question && item ? (
        <div className="space-y-3 rounded-xl border border-primary/40 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{t('plan.review.question')}</p>
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
        </div>
      ) : null}
      <div className="grid gap-3">
        <Button type="button" className="h-11 w-full" loading={saving} onClick={accept}>
          {t('plan.review.looksRight')}
        </Button>
        <div className={onBack ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full"
              disabled={saving}
              onClick={onBack}
            >
              {t('plan.review.back')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={saving}
            onClick={() => {
              setDraft(slot);
              setEditing(true);
            }}
          >
            {t('plan.review.fix')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** One prescribed item: the amount before the name ("2 × سیب", "150 g · مرغ"), grams each for counts. */
export function ItemRow({ item }: { item: DraftItem }) {
  return (
    <li className="flex items-start justify-between gap-3 text-sm">
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

function hasItems(slot: DraftSlot) {
  return slot.options.every(
    (o) => o.items.length > 0 && o.items.every((i) => i.originalName.trim() !== ''),
  );
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
