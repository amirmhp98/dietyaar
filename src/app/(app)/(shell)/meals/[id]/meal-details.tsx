'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import {
  deleteMealAction,
  removeMealPhotoAction,
  setMealLinkAction,
  updateMealAction,
} from '@/actions/meal.actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  toast,
} from '@/components/UiComponents';
import { DifferenceChip, type DifferenceKind } from '@/components/product/DifferenceChip';
import { Disclosure } from '@/components/product/Disclosure';
import { MealReview } from '@/components/product/MealReview';
import { NameLabel } from '@/components/product/NameLabel';
import { useComposerOpener } from '@/components/product/composer-bus';
import { valuesLine } from '@/components/product/meal/ItemRow';
import { OTHER_SLOT, SlotSelect, optionLabel } from '@/components/product/meal/SlotPicker';
import { NUTRIENT_UNITS, portionValues, sumTotals } from '@/components/product/meal/totals';
import { formatDate, formatNumber, formatTime } from '@/lib/format';
import type { RubricSlot, SlotView } from '@/lib/rubric/types';
import { t } from '@/lib/t';
import { instantFor } from '@/lib/time';
import type { DraftFoodItem, MealDraftState } from '@/lib/validations/meal';
import { MAIN_NUTRIENTS, NUTRIENT_KEYS } from '@/lib/validations/nutrition';
import type { MealFoodItemView, MealView } from '@/services/meal.service';

function toDraftItem(item: MealFoodItemView): DraftFoodItem {
  return {
    key: item.id,
    position: item.position,
    originalName: item.originalName,
    englishLabel: item.englishLabel,
    quantity: item.quantity,
    unit: item.unit,
    quantityUnknown: item.quantityUnknown,
    quantityAssumed: item.quantityAssumed,
    preparation: item.preparation,
    category: item.category,
    alternatives: item.alternatives.map((a) => ({ ...a, nutrition: a.nutrition ?? null })),
    chosenAlternative: null,
    nutrition: item.nutrition,
    matchedPlanItemId: item.matchedPlanItemId,
    isAddedItem: item.isAddedItem,
    needsReestimate: false,
    previousNutrition: null,
    scaleFlag: null,
  };
}

function toDraftState(meal: MealView): MealDraftState {
  return {
    kind: meal.inputKind,
    text: meal.originalText,
    uploadIds: meal.uploads.map((u) => u.id),
    localDate: meal.localDate,
    time: meal.consumedLocalTime,
    planSlotId: meal.planSlotId,
    planOptionId: meal.planOptionId,
    notes: meal.notes,
    items: meal.items.map(toDraftItem),
    questions: [],
    copiedFromMealId: meal.copiedFromMealId,
    restrictionHits: meal.items
      .filter((i) => i.restrictionHit)
      .map((i) => ({ itemKey: i.id, restriction: i.restrictionHit as string })),
    lastChanges: [],
  };
}

function mealName(meal: MealView): string {
  return meal.items.length > 0
    ? meal.items.map((i) => i.englishLabel).join(', ')
    : t('meal.details.title');
}

/** Differences from the slot comparison (design-scope screen 5). */
function differences(slotView: SlotView | null): Array<{ kind: DifferenceKind; text: string }> {
  if (!slotView) return [];
  const out: Array<{ kind: DifferenceKind; text: string }> = [];
  const match = slotView.match;
  if (match) {
    if (match.reason === 'CROSS_SLOT' && match.crossSlot) {
      out.push({
        kind: 'CROSS_SLOT',
        text: t('meal.details.diff.crossSlot', {
          slot: match.crossSlot.englishLabel.toLowerCase(),
        }),
      });
    }
    if (match.missing.length > 0) {
      out.push({
        kind: 'MISSING',
        text: t('meal.details.diff.missing', {
          names: match.missing.map((m) => m.englishLabel).join(', '),
        }),
      });
    }
    if (match.added.length > 0) {
      out.push({
        kind: 'ADDED',
        text: t('meal.review.added', { names: match.added.map((a) => a.englishLabel).join(', ') }),
      });
    }
    if (match.status === 'DIFFERENT_FOOD' && !match.reason) {
      out.push({ kind: 'DIFFERENT_FOOD', text: t('meal.review.match.DIFFERENT_FOOD') });
    }
  }
  for (const p of slotView.portion?.items ?? []) {
    if (p.band === 'SMALL') continue;
    const params = {
      item: p.item.englishLabel,
      actual: formatNumber(p.actual, { maximumFractionDigits: 1 }),
      planned: formatNumber(p.planned, { maximumFractionDigits: 1 }),
      unit: p.unit,
    };
    out.push(
      p.ratio > 0
        ? { kind: 'PORTION_MORE', text: t('meal.details.diff.portionMore', params) }
        : { kind: 'PORTION_LESS', text: t('meal.details.diff.portionLess', params) },
    );
  }
  const timing = slotView.timing;
  if (
    timing?.kind === 'TIME' &&
    timing.band &&
    timing.band !== 'SMALL' &&
    timing.minutes !== null
  ) {
    const minutes = formatNumber(Math.abs(timing.minutes));
    out.push({
      kind: 'TIME',
      text:
        timing.minutes < 0
          ? t('meal.details.diff.timeEarly', { minutes })
          : t('meal.details.diff.timeLate', { minutes }),
    });
  }
  if (timing?.kind === 'ORDER' && timing.outOfOrderWith) {
    out.push({
      kind: 'ORDER',
      text: t('meal.details.diff.order', {
        direction:
          timing.outOfOrderWith.direction === 'BEFORE'
            ? t('meal.details.diff.before')
            : t('meal.details.diff.after'),
        slot: timing.outOfOrderWith.slot.englishLabel,
      }),
    });
  }
  return out;
}

export function MealDetails({
  meal,
  slotView,
  slots,
  photos,
  today,
}: {
  meal: MealView;
  slotView: SlotView | null;
  slots: RubricSlot[];
  photos: Array<{ id: string; url: string }>;
  today: string;
}) {
  const router = useRouter();
  const openComposer = useComposerOpener();
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<MealDraftState | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState<{ slotId: string | null; optionId: string | null }>({
    slotId: meal.planSlotId ?? OTHER_SLOT,
    optionId: meal.planOptionId,
  });
  const [pending, setPending] = useState(false);
  const [photoToRemove, setPhotoToRemove] = useState<string | null>(null);

  const totals = useMemo(() => sumTotals(meal.items), [meal.items]);
  const slot = slots.find((s) => s.id === meal.planSlotId) ?? null;
  const option = slot?.options.find((o) => o.id === meal.planOptionId) ?? null;
  const optionIndex = slot
    ? [...slot.options]
        .sort((a, b) => a.position - b.position)
        .findIndex((o) => o.id === option?.id)
    : -1;
  const diffs = useMemo(() => differences(slotView), [slotView]);
  const name = mealName(meal);
  // The meal's day carries the zone it was computed in.
  const zone = meal.timeZone;
  const dateLabel = formatDate(instantFor(meal.localDate, '12:00', zone), { timeZone: zone });
  const timeLabel = meal.consumedLocalTime
    ? formatTime(instantFor(meal.localDate, meal.consumedLocalTime, zone), { timeZone: zone })
    : t('meal.details.timeUnknown');
  const extraNutrients = NUTRIENT_KEYS.filter(
    (k) => !(MAIN_NUTRIENTS as readonly string[]).includes(k),
  );

  function startEdit() {
    setEditState(toDraftState(meal));
    setEditError(null);
    setConflict(false);
    setEditing(true);
  }

  async function saveEdit() {
    if (!editState) return;
    setSaving(true);
    setEditError(null);
    const items = editState.items
      .filter((i) => i.originalName.trim() !== '')
      .map((i, position) => ({
        ...i,
        position,
        englishLabel: i.englishLabel.trim() || i.originalName.trim(),
      }));
    const result = await updateMealAction({
      mealId: meal.id,
      expectedRevision: meal.revision,
      edits: {
        time: editState.time,
        localDate: editState.localDate,
        notes: editState.notes,
        items,
      },
    });
    setSaving(false);
    if (result.ok) {
      toast.success(t('meal.details.updated'));
      setEditing(false);
      setEditState(null);
      router.refresh();
      return;
    }
    if (result.code === 'CONFLICT') {
      setConflict(true);
      return;
    }
    setEditError(result.code === 'FUTURE_TIME' ? result.error : t('meal.errors.saveFailed'));
  }

  async function applyLink() {
    setPending(true);
    const planSlotId = link.slotId && link.slotId !== OTHER_SLOT ? link.slotId : null;
    const result = await setMealLinkAction({
      mealId: meal.id,
      expectedRevision: meal.revision,
      planSlotId,
      planOptionId: planSlotId ? link.optionId : null,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      if (result.code === 'CONFLICT') router.refresh();
      return;
    }
    toast.success(t('meal.details.linkUpdated'));
    setLinking(false);
    router.refresh();
  }

  async function removePhoto(uploadId: string) {
    setPhotoToRemove(null);
    const result = await removeMealPhotoAction({ uploadId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t('meal.details.photoRemoved'));
    router.refresh();
  }

  async function remove() {
    setPending(true);
    const result = await deleteMealAction({ mealId: meal.id, expectedRevision: meal.revision });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      if (result.code === 'CONFLICT') router.refresh();
      return;
    }
    toast.success(t('meal.details.deleted'));
    router.push('/today');
  }

  if (editing && editState) {
    return (
      <div className="space-y-4" data-testid="meal-edit">
        <h1 className="text-xl font-semibold">{t('meal.review.title')}</h1>
        <MealReview
          mode="edit"
          state={editState}
          onChange={(patch) => {
            setEditState((prev) => (prev ? { ...prev, ...patch } : prev));
            setEditError(null);
          }}
          match={slotView?.match ?? null}
          slots={slots}
          lastUsed={{}}
          otherChosen={meal.planSlotId === null}
          sync="saved"
          online
          conflict={conflict}
          saving={saving}
          error={editError}
          canReestimate={false}
          onReestimate={() => undefined}
          onSave={saveEdit}
          onReload={() => {
            setConflict(false);
            router.refresh();
          }}
          onCancel={() => {
            setEditing(false);
            setEditState(null);
          }}
          saveLabel={t('meal.review.save')}
          dateSummary={`${dateLabel} · ${timeLabel}`}
          today={today}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="meal-details">
      <Link
        href="/today"
        className="-ms-1 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t('meal.details.backToToday')}
      </Link>

      <header className="space-y-1">
        <h1 className="text-xl font-semibold" data-testid="meal-title">
          {meal.items[0] ? (
            <NameLabel
              originalName={meal.items[0].originalName}
              englishLabel={name}
              size="lg"
              inline
            />
          ) : (
            t('meal.details.title')
          )}
        </h1>
        <p className="text-sm text-muted-foreground" data-testid="meal-time">
          {dateLabel} · {timeLabel}
        </p>
      </header>

      <section
        className="space-y-2 rounded-xl border border-border bg-card p-4"
        aria-labelledby="link-title"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="link-title" className="text-sm font-semibold">
            {t('meal.details.linkedTo')}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => setLinking((v) => !v)}
            aria-expanded={linking}
            data-testid="change-link"
          >
            {t('meal.details.changeLink')}
          </Button>
        </div>
        {slot ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="meal-link">
            <NameLabel
              originalName={slot.originalName}
              englishLabel={slot.englishLabel}
              inline
              size="sm"
            />
            {option ? (
              <Badge variant="secondary">
                <bdi>{optionLabel(option, optionIndex)}</bdi>
              </Badge>
            ) : null}
          </div>
        ) : (
          <div data-testid="meal-link">
            <p className="text-sm">{t('meal.details.other')}</p>
            <p className="text-xs text-muted-foreground">{t('meal.details.otherHint')}</p>
          </div>
        )}
        {slotView?.match ? (
          <p className="text-sm text-muted-foreground" data-testid="meal-match">
            {t(`meal.review.match.${slotView.match.status}`)}
            {slotView.match.reason && slotView.match.reason !== 'CROSS_SLOT'
              ? ` · ${t(`meal.review.reason.${slotView.match.reason}`)}`
              : ''}
          </p>
        ) : null}
        {linking ? (
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">
              {t('meal.details.changeLinkHint', { date: dateLabel })}
            </p>
            <SlotSelect
              slots={slots}
              slotId={link.slotId}
              optionId={link.optionId}
              lastUsed={{}}
              idPrefix="details"
              onChange={(slotId, optionId) => setLink({ slotId, optionId })}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => setLinking(false)}
              >
                {t('meal.details.cancel')}
              </Button>
              <Button
                type="button"
                className="h-11 flex-1"
                onClick={applyLink}
                disabled={
                  pending ||
                  (!!link.slotId &&
                    link.slotId !== OTHER_SLOT &&
                    (slots.find((s) => s.id === link.slotId)?.options.length ?? 0) > 1 &&
                    !link.optionId)
                }
                data-testid="apply-link"
              >
                {t('meal.details.applyLink')}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-2" aria-labelledby="items-title">
        <h2 id="items-title" className="text-sm font-semibold">
          {t('meal.details.items')}
        </h2>
        <ul
          className="divide-y divide-border rounded-xl border border-border bg-card"
          data-testid="meal-items"
        >
          {meal.items.map((item) => (
            <li key={item.id} className="space-y-1 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <NameLabel
                  originalName={item.originalName}
                  englishLabel={item.englishLabel}
                  className="items-start"
                />
                <span className="text-sm tabular-nums" dir="ltr">
                  {item.quantityUnknown || item.quantity === null
                    ? t('meal.details.quantityUnknown')
                    : `${formatNumber(item.quantity, { maximumFractionDigits: 1 })} ${item.unit ?? ''}`}
                </span>
              </div>
              {item.preparation ? (
                <p className="text-xs text-muted-foreground">
                  <bdi>{item.preparation}</bdi>
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground" dir="ltr">
                {valuesLine(portionValues(item)) ?? t('meal.review.sourceNone')}
              </p>
              {item.restrictionHit ? (
                <p className="text-sm">
                  {t('meal.review.restriction', { item: item.restrictionHit })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section
        className="rounded-xl border border-border bg-card p-4"
        aria-labelledby="nutrition-title"
      >
        <h2 id="nutrition-title" className="text-sm font-semibold">
          {t('meal.details.nutrition')}
        </h2>
        <dl className="mt-2 grid grid-cols-4 gap-2" data-testid="meal-nutrition">
          {MAIN_NUTRIENTS.map((key) => (
            <div key={key}>
              <dt className="text-xs text-muted-foreground">{t(`meal.nutrient.${key}`)}</dt>
              <dd className="text-base font-semibold tabular-nums" dir="ltr">
                {totals.values[key] === null
                  ? t('meal.nutrient.unknown')
                  : `${formatNumber(totals.values[key], { maximumFractionDigits: 0 })} ${t(`meal.nutrient.unit.${NUTRIENT_UNITS[key]}`)}`}
              </dd>
            </div>
          ))}
        </dl>
        {totals.incomplete ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('meal.review.unknownValues')}.</p>
        ) : null}
        <Disclosure label={t('meal.details.more')} className="mt-2">
          <dl className="grid grid-cols-2 gap-2">
            {extraNutrients.map((key) => (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">{t(`meal.nutrient.${key}`)}</dt>
                <dd className="text-sm tabular-nums" dir="ltr">
                  {totals.values[key] === null
                    ? t('meal.nutrient.unknown')
                    : `${formatNumber(totals.values[key], { maximumFractionDigits: 1 })} ${t(`meal.nutrient.unit.${NUTRIENT_UNITS[key]}`)}`}
                </dd>
              </div>
            ))}
          </dl>
        </Disclosure>
        <Disclosure label={t('meal.review.sources')}>
          <ul className="space-y-1 text-sm">
            {meal.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline gap-x-2">
                <NameLabel
                  originalName={item.originalName}
                  englishLabel={item.englishLabel}
                  inline
                  size="sm"
                />
                <span className="text-muted-foreground">
                  {item.nutrition
                    ? `${t(`meal.review.source.${item.nutrition.source}`)}${item.nutrition.sourceRef ? ` · ${item.nutrition.sourceRef}` : ''}`
                    : t('meal.review.sourceNone')}
                </span>
              </li>
            ))}
          </ul>
        </Disclosure>
      </section>

      {photos.length > 0 ? (
        <section className="space-y-2" aria-labelledby="photos-title">
          <h2 id="photos-title" className="text-sm font-semibold">
            {t('meal.details.photos')}
          </h2>
          <div className="flex flex-wrap gap-3" data-testid="meal-photos">
            {photos.map((photo, index) => (
              <figure key={photo.id} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- account-bound photo URL */}
                <img
                  src={photo.url}
                  alt={t('meal.details.photoAlt', { index: index + 1 })}
                  className="size-32 rounded-md border border-border object-cover"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9"
                  onClick={() => setPhotoToRemove(photo.id)}
                >
                  {t('meal.details.removePhoto')}
                </Button>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {meal.notes ? (
        <section className="space-y-1" aria-labelledby="notes-title">
          <h2 id="notes-title" className="text-sm font-semibold">
            {t('meal.details.notes')}
          </h2>
          <p className="text-sm">
            <bdi>{meal.notes}</bdi>
          </p>
        </section>
      ) : null}

      {slotView ? (
        <section className="space-y-2" aria-labelledby="diff-title">
          <h2 id="diff-title" className="text-sm font-semibold">
            {t('meal.details.differences')}
          </h2>
          {diffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('meal.details.noDifferences')}</p>
          ) : (
            <div className="flex flex-wrap gap-2" data-testid="meal-differences">
              {diffs.map((d, i) => (
                <DifferenceChip key={i} kind={d.kind}>
                  {d.text}
                </DifferenceChip>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={startEdit}
          data-testid="edit-meal"
        >
          <Pencil className="size-4" aria-hidden="true" />
          {t('meal.details.edit')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => openComposer({ reuseMealId: meal.id })}
          data-testid="reuse-meal"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {t('meal.details.reuse')}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              className="col-span-2 h-11"
              data-testid="delete-meal"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t('meal.details.delete')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('meal.details.deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="block font-medium text-foreground" dir="ltr">
                  {name}
                </span>
                {t('meal.details.deleteBody')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-11">{t('meal.details.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className="h-11"
                onClick={remove}
                disabled={pending}
                data-testid="confirm-delete"
              >
                {t('meal.details.deleteConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <AlertDialog open={photoToRemove !== null} onOpenChange={(o) => !o && setPhotoToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('meal.details.removePhotoTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('meal.details.removePhotoBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">{t('meal.details.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              onClick={() => photoToRemove && removePhoto(photoToRemove)}
            >
              {t('meal.details.removePhoto')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
