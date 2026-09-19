import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { dayInput, eaten, meal } from '@/__tests__/fixtures/plans/builders';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';
import { ScoreCard } from '@/components/product/ScoreCard';
import { WhyThisScore } from '@/components/product/WhyThisScore';
import { computeDayView } from '@/lib/rubric/day-view';
import type { DayScore } from '@/lib/rubric/types';
import { t } from '@/lib/t';

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
  it('reads "In progress" on today and names the date on a past day', () => {
    expect(renderToStaticMarkup(<ScoreCard score={scored} ongoing />)).toContain(
      t('score.inProgress'),
    );
    const past = renderToStaticMarkup(
      <ScoreCard score={scored} ongoing={false} dateLabel="Sep 18" />,
    );
    expect(past).toContain(t('score.titleDate', { date: 'Sep 18' }));
    expect(past).not.toContain(t('score.title'));
    // Without a date the generic title stays (the components gallery).
    expect(renderToStaticMarkup(<ScoreCard score={scored} ongoing={false} />)).toContain(
      t('score.title'),
    );
  });

  it('explains what unlocks the number while there is not enough information', () => {
    const html = renderToStaticMarkup(<ScoreCard score={notEnough} ongoing={false} />);
    expect(html).toContain(t('score.notEnough'));
    expect(html).toContain(t('score.notEnoughHint'));
    expect(html).not.toContain('data-testid="score-coverage"');
    expect(html).not.toContain('data-testid="score-number"');

    const withScore = renderToStaticMarkup(<ScoreCard score={scored} ongoing={false} />);
    expect(withScore).not.toContain(t('score.notEnoughHint'));
    expect(withScore).toContain('data-testid="score-number"');
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
