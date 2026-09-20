import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { dayInput, eaten, meal } from '@/__tests__/fixtures/plans/builders';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';
import { ScoreCard } from '@/components/product/ScoreCard';
import { WhyThisScore } from '@/components/product/WhyThisScore';
import { computeDayView } from '@/lib/rubric/day-view';
import type { DayScore } from '@/lib/rubric/types';
import { t, tp } from '@/lib/t';

const notEnough: DayScore = {
  dayScore: null,
  showNumber: false,
  band: 'NOT_ENOUGH',
  coverage: { prescribed: 5, recorded: 0, scored: 0, skipped: 0, needsReview: 0, notRecorded: 5 },
  completeByDefault: false,
  nutritionComponent: null,
  mealMean: null,
};

const scored: DayScore = {
  ...notEnough,
  dayScore: 78,
  showNumber: true,
  band: 'MOSTLY',
  coverage: { prescribed: 5, recorded: 2, scored: 2, skipped: 1, needsReview: 0, notRecorded: 2 },
  mealMean: 78,
};

describe('ScoreCard', () => {
  it('is the hero surface with the band glyph, the numeral and the coverage line', () => {
    const html = renderToStaticMarkup(<ScoreCard score={scored} ongoing />);
    expect(html).toContain('data-surface="hero"');
    expect(html).toContain('data-testid="glyph-band-MOSTLY"');
    expect(html).toMatch(/data-testid="score-number"[^>]*>78</);
    expect(html).toMatch(/data-testid="score-band"[^>]*>Mostly followed</);
    expect(html).toContain(tp('score.coverage', 2, { total: 5 }));
    expect(html).toContain(tp('score.skipped', 1));
    // The numeral is the only 40 px, weight-700 text; nothing else is filled emerald.
    expect(html).toContain('text-numeral');
    expect(html).not.toContain('bg-primary');
  });

  it('reads "In progress" on today only; a past day leaves the eyebrow to the section header', () => {
    expect(renderToStaticMarkup(<ScoreCard score={scored} ongoing />)).toContain(
      t('score.inProgress'),
    );
    expect(renderToStaticMarkup(<ScoreCard score={scored} ongoing={false} />)).not.toContain(
      t('score.inProgress'),
    );
  });

  it('carries a neutral "N of M recorded" progress bar', () => {
    const html = renderToStaticMarkup(<ScoreCard score={scored} ongoing />);
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="40"/);
    expect(html).toContain(`aria-label="${tp('day.recordedMeals', 2, { prescribed: 5 })}"`);
    expect(html).toContain('width:40%');
    // Nothing recorded: the bar sits at zero rather than disappearing.
    const empty = renderToStaticMarkup(<ScoreCard score={notEnough} ongoing />);
    expect(empty).toMatch(/role="progressbar"[^>]*aria-valuenow="0"/);
  });

  it('explains what unlocks the number while there is not enough information', () => {
    const html = renderToStaticMarkup(<ScoreCard score={notEnough} ongoing={false} />);
    expect(html).toContain('data-testid="glyph-band-IN_PROGRESS"');
    expect(html).toContain(t('score.notEnough'));
    expect(html).toContain(t('score.notEnoughHint'));
    expect(html).not.toContain('data-testid="score-coverage"');
    expect(html).not.toContain('data-testid="score-number"');

    const withScore = renderToStaticMarkup(<ScoreCard score={scored} ongoing={false} />);
    expect(withScore).not.toContain(t('score.notEnoughHint'));
    expect(withScore).toContain('data-testid="score-number"');
  });

  it('shows the band word alone with one scored meal', () => {
    const one: DayScore = {
      ...scored,
      showNumber: false,
      band: 'DIFFERENT',
      coverage: { ...scored.coverage, recorded: 1, scored: 1, skipped: 0, notRecorded: 4 },
    };
    const html = renderToStaticMarkup(<ScoreCard score={one} ongoing />);
    expect(html).not.toContain('data-testid="score-number"');
    expect(html).toContain('data-testid="glyph-band-DIFFERENT"');
    expect(html).toMatch(/data-testid="score-band"[^>]*>Different from your plan</);
    expect(html).toContain(tp('score.coverage', 1, { total: 5 }));
  });
});

describe('WhyThisScore', () => {
  it('renders nothing until a prescribed meal is scored, then the disclosure', () => {
    const p = buildMenuPlan();
    const empty = computeDayView(dayInput(p.slots, { meals: [] }));
    expect(renderToStaticMarkup(<WhyThisScore view={empty} />)).toBe('');

    const opt = p.lunch.options[0];
    const withLunch = computeDayView(
      dayInput(p.slots, {
        meals: [
          meal(
            p.lunch.id,
            opt.id,
            '13:00',
            opt.items.filter((i) => i.quantity !== null).map((i) => eaten(i)),
          ),
        ],
      }),
    );
    // Collapsed by default: the trigger renders, the content does not.
    const html = renderToStaticMarkup(<WhyThisScore view={withLunch} />);
    expect(html).toContain(t('day.why.title'));
    expect(html).toContain('data-testid="why-this-score"');
    expect(html).not.toContain(t('day.why.food'));
  });
});
