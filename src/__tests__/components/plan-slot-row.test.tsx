import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { dayInput, eaten, meal } from '@/__tests__/fixtures/plans/builders';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';
import { glyphFor, PlanSlotRow } from '@/components/product/PlanSlotRow';
import { computeDayView } from '@/lib/rubric/day-view';
import type { SlotView } from '@/lib/rubric/types';
import { t } from '@/lib/t';

const noop = () => {};

function slotsAt(nowLocalTime: string | null, dayPhase: 'ONGOING' | 'PAST' = 'ONGOING') {
  const p = buildMenuPlan();
  return computeDayView(dayInput(p.slots, { dayPhase, nowLocalTime })).slots;
}

function render(slot: SlotView, highlighted = false) {
  return renderToStaticMarkup(
    <PlanSlotRow slot={slot} highlighted={highlighted} onLog={noop} onSkip={noop} />,
  );
}

/** Lunch option 1 eaten at 13:00 plus the first snack skipped, seen at 16:00. */
function recordedDay() {
  const p = buildMenuPlan();
  const slots = p.slots.map((s) =>
    s.id === p.lunch.id ? { ...s, timeStart: '12:30', timeEnd: '13:30' } : s,
  );
  const opt = p.lunch.options[0];
  return computeDayView(
    dayInput(slots, {
      dayPhase: 'ONGOING',
      nowLocalTime: '16:00',
      meals: [
        meal(
          p.lunch.id,
          opt.id,
          '13:00',
          opt.items.filter((i) => i.quantity !== null).map((i) => eaten(i)),
        ),
      ],
      skippedSlotIds: [p.snack1.id],
    }),
  );
}

describe('PlanSlotRow', () => {
  it('OPEN and not recorded: the ○ glyph, an outline icon Log, a ghost icon Skip, window in the subline', () => {
    const [breakfast] = slotsAt('08:00');
    const html = render(breakfast);
    expect(html).toContain('data-window-state="OPEN"');
    expect(html).toContain('data-testid="glyph-NOT_RECORDED"');
    expect(html).toMatch(/data-testid="slot-status"[^>]*>Not recorded</);
    expect(html).toContain('data-testid="log-slot"');
    expect(html).toContain(`aria-label="${t('slot.logAria', { slot: 'صبحانه' })}"`);
    // Icon-only: the word is the accessible name, not visible text.
    expect(html).not.toContain(`>${t('slot.log')}<`);
    expect(html).toMatch(/border-input[^>]*data-testid="log-slot"/);
    expect(html).toContain('data-testid="mark-skipped"');
    expect(html).toContain(`aria-label="${t('slot.skipAria', { slot: 'صبحانه' })}"`);
    expect(html).toContain(t('plan.time.assumedRange', { start: '06:00', end: '10:30' }));
    expect(html).not.toContain('data-testid="window-passed"');
    expect(html).not.toContain('data-testid="log-slot-early"');
    expect(html).not.toContain('data-testid="log-this-meal"');
  });

  it('UPCOMING and not recorded: the ◷ glyph (named for screen readers), one faint icon Log, no Skip', () => {
    const [, , lunch] = slotsAt('08:00');
    const html = render(lunch);
    expect(html).toContain('data-window-state="UPCOMING"');
    expect(html).toContain('data-testid="glyph-UPCOMING"');
    expect(html).toContain(`<span class="sr-only">${t('glyph.status.upcoming')}</span>`);
    expect(html).toContain('data-testid="log-slot-early"');
    expect(html).toContain(`aria-label="${t('slot.logEarly', { slot: 'ناهار' })}"`);
    expect(html).not.toContain('data-testid="mark-skipped"');
    expect(html).not.toContain('data-testid="log-slot"');
    expect(html).toContain(t('slot.state.notRecorded'));
    // The subline: window first, then the option count, then the energy range; no instruction text.
    expect(html).toContain(
      `${t('plan.time.assumedRange', { start: '12:00', end: '15:30' })} · ${t('slot.options', { count: 4 })}`,
    );
    expect(html).not.toContain('choose what you ate');
  });

  it('PASSED and not recorded: Log and Skip plus the "Window passed" line', () => {
    const [breakfast] = slotsAt('16:00');
    const html = render(breakfast);
    expect(html).toContain('data-window-state="PASSED"');
    expect(html).toContain('data-testid="glyph-NOT_RECORDED"');
    expect(html).toContain('data-testid="log-slot"');
    expect(html).toContain('data-testid="mark-skipped"');
    expect(html).toContain(t('slot.window.passed'));
  });

  it('the highlighted row is tinted and keeps the full-width outline "Log this meal" and a Skip icon, whatever its state', () => {
    const [breakfast] = slotsAt('05:00');
    const html = render(breakfast, true);
    expect(html).toContain('data-window-state="UPCOMING"');
    expect(html).toContain('bg-tint-1');
    expect(html).toContain('data-testid="log-this-meal"');
    expect(html).toContain(t('day.plan.logThis'));
    expect(html).toContain('data-testid="mark-skipped"');
    expect(html).not.toContain('data-testid="log-slot"');
    expect(html).not.toContain('data-testid="log-slot-early"');
    // Outline, not the filled primary: the floating Log meal button stays the one filled emerald.
    expect(html).not.toContain('bg-primary');
    expect(html).toMatch(/border-input[^>]*data-testid="log-this-meal"/);
  });

  it('a recorded row is one expandable target with the ● glyph; a skipped row shows — and Undo skip', () => {
    const view = recordedDay();
    const lunch = render(view.slots[2]);
    expect(lunch).toContain('data-testid="glyph-RECORDED"');
    expect(lunch).toContain('data-testid="slot-details"');
    expect(lunch).toMatch(/data-testid="slot-status"[^>]*>Matches your plan</);
    expect(lunch).toContain(t('plan.time.range', { start: '12:30', end: '13:30' }));
    expect(lunch).not.toContain('≈');
    expect(lunch).not.toContain('data-testid="log-slot"');
    expect(lunch).not.toContain('data-testid="mark-skipped"');
    expect(lunch).not.toContain('data-testid="window-passed"');

    const skipped = render(view.slots[1]);
    expect(skipped).toContain('data-testid="glyph-SKIPPED"');
    expect(skipped).toMatch(/data-testid="slot-status"[^>]*>Marked skipped</);
    expect(skipped).toContain('data-testid="unskip"');
    expect(skipped).toContain(`aria-label="${t('slot.unskip')}"`);
    expect(skipped).not.toContain('data-testid="log-slot"');
    expect(skipped).not.toContain('data-testid="window-passed"');
  });

  it('a past day: every unrecorded row has passed', () => {
    const rows = slotsAt(null, 'PAST');
    for (const row of rows) {
      const html = render(row);
      expect(html).toContain('data-window-state="PASSED"');
      expect(html).toContain(t('slot.window.passed'));
    }
  });
});

describe('glyphFor', () => {
  it('maps the record state, then the match result, to one glyph', () => {
    const view = recordedDay();
    const [breakfast, snack1, lunch] = view.slots;
    expect(glyphFor(breakfast)).toBe('NOT_RECORDED');
    expect(glyphFor(snack1)).toBe('SKIPPED');
    expect(glyphFor(lunch)).toBe('RECORDED');
    expect(glyphFor({ ...breakfast, windowState: 'UPCOMING' })).toBe('UPCOMING');
    expect(glyphFor({ ...breakfast, state: 'NEEDS_REVIEW' })).toBe('NEEDS_REVIEW');
    expect(glyphFor({ ...lunch, match: { ...lunch.match!, status: 'PARTLY_MATCHED' } })).toBe(
      'PARTLY',
    );
    expect(glyphFor({ ...lunch, match: { ...lunch.match!, status: 'DIFFERENT_FOOD' } })).toBe(
      'DIFFERENT',
    );
  });
});
