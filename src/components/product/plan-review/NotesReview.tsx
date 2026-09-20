'use client';

import { StickyNote } from 'lucide-react';
import { SectionHeader } from '@/components/product/SectionHeader';
import { Surface } from '@/components/product/Surface';
import { t, tp } from '@/lib/t';
import type { DraftNote } from '@/lib/validations/plan';
import { ReviewActions } from './SlotReview';

/**
 * Screen 7c: the plan's notes, read-only (decision 023), as one note
 * surface. Every instruction that is not a meal, target or schedule is
 * shown verbatim with why it is a note, never evaluated; then Confirm plan
 * with the "N meals affected" line when past meals are linked.
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
        <section className="space-y-3">
          <SectionHeader icon={StickyNote} title={t('plan.page.notes')} level={3} />
          <Surface variant="note" padding="none">
            <ul className="divide-y divide-border/60" data-testid="plan-notes">
              {notes.map((note) => (
                <li key={note.key} className="space-y-0.5 px-4 py-3 text-sm">
                  <p dir="auto">
                    <bdi>{note.originalText}</bdi>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`plan.review.notes.reason.${note.reason}`)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="px-4 pb-3 pt-1 text-xs text-muted-foreground">
              {t('plan.review.notes.hint')}
            </p>
          </Surface>
        </section>
      )}
      <p className="text-sm text-muted-foreground">{t('plan.review.changeLater')}</p>
      {affectedMeals !== null && affectedMeals > 0 ? (
        <Surface variant="note" rule padding="none" className="py-1">
          <p className="text-sm" data-testid="affected-meals">
            {tp('plan.review.affected', affectedMeals)}
          </p>
        </Surface>
      ) : null}
      <ReviewActions
        primary={t('plan.review.confirm')}
        primaryTestId="confirm-plan"
        saving={saving}
        onPrimary={onConfirm}
        onBack={onBack}
      />
    </div>
  );
}
