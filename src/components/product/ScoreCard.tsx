import { t, tp } from '@/lib/t';
import type { DayScore } from '@/lib/rubric/types';
import { cn } from '@/lib/utils';

/**
 * Score card (product spec § 8 display): integer + wording band + coverage,
 * "In progress" on today, "Not enough information yet" before any scored meal
 * (with the hint that two planned meals unlock the number). A past day names
 * its date in the eyebrow. The number appears only with two scored meals.
 * Never colour-keyed.
 */
export function ScoreCard({
  score,
  ongoing,
  dateLabel,
  children,
  className,
}: {
  score: DayScore;
  ongoing: boolean;
  /** The formatted day, shown in the eyebrow of a past day; omitted on today. */
  dateLabel?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { coverage } = score;
  const eyebrow = ongoing
    ? t('score.inProgress')
    : dateLabel
      ? t('score.titleDate', { date: dateLabel })
      : t('score.title');
  const bandLabel =
    score.band === 'CLOSELY'
      ? t('score.band.closely')
      : score.band === 'MOSTLY'
        ? t('score.band.mostly')
        : score.band === 'DIFFERENT'
          ? t('score.band.different')
          : t('score.notEnough');
  const coverageParts = [tp('score.coverage', coverage.scored, { total: coverage.prescribed })];
  if (coverage.skipped > 0) coverageParts.push(tp('score.skipped', coverage.skipped));
  if (score.completeByDefault) coverageParts.push(t('score.completeByDefault'));

  return (
    <div
      className={cn('rounded-xl border border-border bg-card p-4', className)}
      data-testid="score-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            {score.showNumber && score.dayScore !== null ? (
              <span className="text-3xl font-semibold tabular-nums" data-testid="score-number">
                {score.dayScore}
              </span>
            ) : null}
            <span className="text-base font-medium" data-testid="score-band">
              {bandLabel}
            </span>
          </div>
          {score.band !== 'NOT_ENOUGH' ? (
            <p className="mt-1 text-xs text-muted-foreground" data-testid="score-coverage">
              {coverageParts.join(' · ')}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground" data-testid="score-hint">
              {t('score.notEnoughHint')}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
