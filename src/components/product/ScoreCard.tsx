import { MeterBar } from '@/components/product/MeterBar';
import { ScoreNumeral } from '@/components/product/ScoreNumeral';
import { BandGlyph, type BandGlyphName } from '@/components/product/StatusGlyph';
import { Surface } from '@/components/product/Surface';
import type { DayScore } from '@/lib/rubric/types';
import { t, tp } from '@/lib/t';

/**
 * Score card (product spec § 8 display, design.md "Product UI" › hero): the
 * one elevated, tinted surface on the page. Band glyph + 40 px numeral (or
 * the band word alone with one scored meal), a thin neutral "N of M
 * recorded" bar, the coverage line; the "In progress" eyebrow on today (the
 * section header above names a past day). Before any scored meal: the
 * hourglass, "Not enough information yet" and the hint that two planned
 * meals unlock the number. Never colour-keyed; the number appears only with
 * two scored meals.
 */
export function ScoreCard({
  score,
  ongoing,
  children,
  className,
}: {
  score: DayScore;
  ongoing: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const { coverage } = score;
  const notEnough = score.band === 'NOT_ENOUGH';
  const band: BandGlyphName = score.band === 'NOT_ENOUGH' ? 'IN_PROGRESS' : score.band;
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
  const showNumber = score.showNumber && score.dayScore !== null;

  return (
    <Surface variant="hero" className={className} data-testid="score-card">
      {ongoing ? (
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('score.inProgress')}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        {/* The visible band word names the state; the glyph is its shape. */}
        <BandGlyph band={band} size="lg" describe={false} className="text-muted-foreground" />
        {showNumber ? (
          <ScoreNumeral
            value={score.dayScore!}
            className="leading-none"
            data-testid="score-number"
          />
        ) : null}
        <span
          className={
            showNumber
              ? 'font-display text-base font-semibold leading-tight'
              : 'font-display text-lg font-semibold leading-tight'
          }
          data-testid="score-band"
        >
          {bandLabel}
        </span>
      </div>
      {coverage.prescribed > 0 ? (
        <MeterBar
          value={coverage.recorded / coverage.prescribed}
          label={tp('day.recordedMeals', coverage.recorded, { prescribed: coverage.prescribed })}
          className="mt-3"
        />
      ) : null}
      {notEnough ? (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="score-hint">
          {t('score.notEnoughHint')}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="score-coverage">
          {coverageParts.join(' · ')}
        </p>
      )}
      {children}
    </Surface>
  );
}
