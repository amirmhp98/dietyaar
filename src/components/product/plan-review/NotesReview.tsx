'use client';

import { Button } from '@/components/UiComponents';
import { t, tp } from '@/lib/t';
import type { DraftNote } from '@/lib/validations/plan';

/**
 * Screen 7c: the plan's notes, read-only (decision 023). Every instruction
 * that is not a meal, target or schedule is shown verbatim with why it is a
 * note, never evaluated; then Confirm plan with the "N meals affected" line
 * when past meals are linked.
 */
export function NotesReview({
  notes,
  affectedMeals,
  saving,
  onConfirm,
  onBack,
}: {
  notes: DraftNote[];
  /** Null while unknown; the line shows only when > 0. */
  affectedMeals: number | null;
  saving: boolean;
  onConfirm: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="space-y-5">
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('plan.review.noNotes')}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t('plan.review.notes.hint')}</p>
          <ul
            className="divide-y divide-border rounded-xl border border-border bg-card"
            data-testid="plan-notes"
          >
            {notes.map((note) => (
              <li key={note.key} className="space-y-1 p-3 text-sm">
                <p dir="auto">
                  <bdi>{note.originalText}</bdi>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(`plan.review.notes.reason.${note.reason}`)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-sm text-muted-foreground">{t('plan.review.changeLater')}</p>
      {affectedMeals !== null && affectedMeals > 0 ? (
        <p className="text-sm" data-testid="affected-meals">
          {tp('plan.review.affected', affectedMeals)}
        </p>
      ) : null}
      <div className="grid gap-3">
        <Button
          type="button"
          className="h-11 w-full"
          loading={saving}
          onClick={onConfirm}
          data-testid="confirm-plan"
        >
          {t('plan.review.confirm')}
        </Button>
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
      </div>
    </div>
  );
}
