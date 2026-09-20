import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { dayInput, eaten, meal } from '@/__tests__/fixtures/plans/builders';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';
import { PlanSlotRow } from '@/components/product/PlanSlotRow';
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

describe('PlanSlotRow', () => {
  it('OPEN and not recorded: outline Log with the word, ghost Skip icon, window in the subline', () => {
    const [breakfast] = slotsAt('08:00');
    const html = render(breakfast);
    expect(html).toContain('data-window-state="OPEN"');
    expect(html).toContain('data-testid="log-slot"');
    expect(html).toContain(`aria-label="${t('slot.logAria', { slot: 'صبحانه' })}"`);
    expect(html).toContain(`>${t('slot.log')}<`);
    expect(html).toContain('data-testid="mark-skipped"');
    expect(html).toContain(`aria-label="${t('slot.skipAria', { slot: 'صبحانه' })}"`);
    expect(html).toContain(t('plan.time.assumedRange', { start: '06:00', end: '10:30' }));
    expect(html).not.toContain('data-testid="window-passed"');
    expect(html).not.toContain('data-testid="log-slot-early"');
    expect(html).not.toContain('data-testid="log-this-meal"');
  });

  it('UPCOMING and not recorded: one faint icon-only Log, no Skip', () => {
    const [, , lunch] = slotsAt('08:00');
    const html = render(lunch);
    expect(html).toContain('data-window-state="UPCOMING"');
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
    expect(html).toContain('data-testid="log-slot"');
    expect(html).toContain('data-testid="mark-skipped"');
    expect(html).toContain(t('slot.window.passed'));
  });

  it('the highlighted row keeps the full-width outline "Log this meal" and a Skip icon, whatever its state', () => {
    const [breakfast] = slotsAt('05:00');
    const html = render(breakfast, true);
    expect(html).toContain('data-window-state="UPCOMING"');
    expect(html).toContain('data-testid="log-this-meal"');
    expect(html).toContain(t('day.plan.logThis'));
    expect(html).toContain('data-testid="mark-skipped"');
    expect(html).not.toContain('data-testid="log-slot"');
    expect(html).not.toContain('data-testid="log-slot-early"');
    // Outline, not the filled primary: the floating Log meal button stays the one filled emerald.
    expect(html).not.toMatch(/data-testid="log-this-meal"[^>]*bg-primary/);
    expect(html).toMatch(/border-input[^>]*data-testid="log-this-meal"/);
  });

  it('a stated window shows without the "≈", and recorded / skipped rows carry no window actions', () => {
    const p = buildMenuPlan();
    const slots = p.slots.map((s) =>
      s.id === p.lunch.id ? { ...s, timeStart: '12:30', timeEnd: '13:30' } : s,
    );
    const opt = p.lunch.options[0];
    const view = computeDayView(
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
    const lunch = render(view.slots[2]);
    expect(lunch).toContain(t('plan.time.range', { start: '12:30', end: '13:30' }));
    expect(lunch).not.toContain('≈');
    expect(lunch).not.toContain('data-testid="log-slot"');
    expect(lunch).not.toContain('data-testid="mark-skipped"');
    expect(lunch).not.toContain('data-testid="window-passed"');
    const skipped = render(view.slots[1]);
    expect(skipped).toContain('data-testid="unskip"');
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
