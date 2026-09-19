import { describe, expect, it } from 'vitest';
import { computeDayView } from '@/lib/rubric/day-view';
import { energyResult } from '@/lib/rubric/energy';
import { matchSlot } from '@/lib/rubric/match-slot';
import { portionBand, portionResult } from '@/lib/rubric/portion';
import { orderResult, timeResult } from '@/lib/rubric/timing';
import { dayInput, eaten, fi, meal, range } from '@/__tests__/fixtures/plans/builders';
import { buildMenuPlan } from '@/__tests__/fixtures/plans/menu-plan';
import { buildWeekdayPlan } from '@/__tests__/fixtures/plans/weekday-plan';

describe('thresholds table (inclusive boundaries)', () => {
  it('portion: 15% is small, 30% noticeable, beyond large', () => {
    expect(portionBand(0.15)).toBe('SMALL');
    expect(portionBand(-0.15)).toBe('SMALL');
    expect(portionBand(0.151)).toBe('NOTICEABLE');
    expect(portionBand(0.3)).toBe('NOTICEABLE');
    expect(portionBand(0.301)).toBe('LARGE');
    expect(portionBand((92 - 80) / 80)).toBe('SMALL'); // exactly 15%: the boundary is inclusive
    expect(portionBand((93 - 80) / 80)).toBe('NOTICEABLE');
    expect(portionBand((160 - 80) / 80)).toBe('LARGE');
  });

  it('energy: inside a range small; beyond the nearer boundary by ≤10% noticeable; approximate within 10% small', () => {
    const r = range(1900, 2100);
    expect(energyResult(2050, r).band).toBe('SMALL');
    expect(energyResult(2100, r).status).toBe('WITHIN');
    expect(energyResult(2310, r)).toMatchObject({
      status: 'ABOVE',
      band: 'NOTICEABLE',
      difference: 210,
    });
    expect(energyResult(2311, r).band).toBe('LARGE');
    expect(energyResult(1710, r)).toMatchObject({
      status: 'BELOW',
      band: 'NOTICEABLE',
      difference: -190,
    });
    const approx = { ...r, type: 'APPROXIMATE' as const, low: 2200, high: null };
    expect(energyResult(2420, approx).band).toBe('SMALL');
    expect(energyResult(2600, approx).band).toBe('NOTICEABLE');
    expect(energyResult(2700, approx).band).toBe('LARGE');
    const min = { ...r, type: 'MINIMUM' as const, low: 100, high: null };
    expect(energyResult(99, min).status).toBe('BELOW');
    expect(energyResult(100, min).status).toBe('WITHIN');
    const max = { ...r, type: 'MAXIMUM' as const, low: null, high: 2000 };
    expect(energyResult(2001, max).status).toBe('ABOVE');
    expect(energyResult(2000, max).status).toBe('WITHIN');
  });

  it('time: 60 minutes small, 120 noticeable, beyond large; 13:25 in a 12:00–13:00 window is 25 min after', () => {
    expect(timeResult('13:25', { start: '12:00', end: '13:00' })).toMatchObject({
      band: 'SMALL',
      minutes: 25,
    });
    expect(timeResult('14:00', { start: '12:00', end: '13:00' })).toMatchObject({
      band: 'SMALL',
      minutes: 60,
    });
    expect(timeResult('14:01', { start: '12:00', end: '13:00' })).toMatchObject({
      band: 'NOTICEABLE',
      minutes: 61,
    });
    expect(timeResult('15:00', { start: '12:00', end: '13:00' })).toMatchObject({
      band: 'NOTICEABLE',
      minutes: 120,
    });
    expect(timeResult('15:01', { start: '12:00', end: '13:00' })).toMatchObject({ band: 'LARGE' });
    expect(timeResult('11:00', { start: '12:00', end: null })).toMatchObject({
      band: 'SMALL',
      minutes: -60,
    });
    expect(timeResult(null, { start: '12:00', end: null })).toMatchObject({
      band: null,
      notEvaluatedReason: 'TIME_UNKNOWN',
    });
  });

  it('time wraps at midnight: 00:30 is 210 min after a 21:00 slot, and a window may cross midnight', () => {
    expect(timeResult('00:30', { start: '21:00', end: null })).toMatchObject({
      band: 'LARGE',
      minutes: 210,
    });
    expect(timeResult('23:30', { start: '00:15', end: null })).toMatchObject({
      band: 'SMALL',
      minutes: -45,
    });
    expect(timeResult('00:15', { start: '23:30', end: '00:30' })).toMatchObject({
      band: 'SMALL',
      minutes: 0,
    });
    expect(timeResult('01:00', { start: '23:30', end: '00:30' })).toMatchObject({
      band: 'SMALL',
      minutes: 30,
    });
  });

  it('order wraps at midnight: a 00:30 dinner after a 21:00 snack stays in plan order', () => {
    const p = buildWeekdayPlan();
    const [, , lunch, snack, dinner] = p.saturday;
    const recorded = [
      { slot: lunch, time: '13:00' },
      { slot: snack, time: '21:00' },
      { slot: dinner, time: '00:30' },
    ];
    expect(orderResult(dinner, recorded).band).toBe('SMALL');
    expect(orderResult(snack, recorded).band).toBe('SMALL');
  });

  it('order rule on the weekday plan: in sequence full, snack after lunch noticeable "eaten after lunch"', () => {
    const p = buildWeekdayPlan();
    const [breakfast, snack, lunch, , dinner] = p.saturday;
    const recorded = [
      { slot: breakfast, time: '10:40' },
      { slot: lunch, time: '14:10' },
      { slot: dinner, time: '21:30' },
    ];
    expect(orderResult(breakfast, recorded).band).toBe('SMALL');
    expect(orderResult(lunch, recorded).band).toBe('SMALL');
    expect(orderResult(dinner, recorded).band).toBe('SMALL');
    const withSnack = [...recorded, { slot: snack, time: '15:00' }];
    const r = orderResult(snack, withSnack);
    expect(r.band).toBe('NOTICEABLE');
    expect(r.outOfOrderWith).toEqual({
      slot: { originalName: 'ناهار', englishLabel: 'Lunch' },
      direction: 'AFTER',
    });
    expect(orderResult(breakfast, [{ slot: breakfast, time: '10:40' }]).notEvaluatedReason).toBe(
      'NO_ORDER_REFERENCE',
    );
    expect(
      orderResult(breakfast, [
        { slot: breakfast, time: null },
        { slot: lunch, time: '14:00' },
      ]).notEvaluatedReason,
    ).toBe('TIME_UNKNOWN');
  });

  it('portion: 120 g of sangak instead of 80 g → Matched with portion none for that item, averaged', () => {
    const p = buildMenuPlan();
    const opt1 = p.breakfast.options[0];
    const items = [
      eaten(opt1.items[0]),
      eaten(opt1.items[1], 120),
      fi('خیار و گوجه', 'cucumber and tomato', null, null, 'VEGETABLE'),
    ];
    const m = matchSlot(items, opt1, p.breakfast, p.slots);
    expect(m.status).toBe('MATCHED');
    const portion = portionResult(m);
    expect(portion.items).toHaveLength(2);
    const sangak = portion.items.find((i) => i.planItem.englishLabel === 'sangak bread')!;
    expect(sangak.band).toBe('LARGE');
    expect(sangak.actual).toBe(120);
    expect(portion.mean).toBe(0.5);
  });

  it('portion: unknown quantity or non-convertible unit is not evaluated, never zero', () => {
    const p = buildMenuPlan();
    const opt1 = p.breakfast.options[0];
    const unknown = eaten(opt1.items[1], null);
    unknown.quantityUnknown = true;
    const m = matchSlot([eaten(opt1.items[0]), unknown], opt1, p.breakfast, p.slots);
    const portion = portionResult(m);
    expect(portion.notEvaluated).toHaveLength(1);
    expect(portion.items).toHaveLength(1);
    const glass = eaten(opt1.items[1], 1);
    glass.unit = 'glass';
    expect(portionResult(matchSlot([glass], opt1, p.breakfast, p.slots)).notEvaluated).toHaveLength(
      1,
    );
  });

  it('per-meal range: 690 kcal within, 790 slightly above (details only, not in the score)', () => {
    const p = buildMenuPlan();
    const opt = p.lunch.options[3];
    const within = computeDayView(
      dayInput(p.slots, {
        targets: p.targets,
        meals: [meal(p.lunch.id, opt.id, '13:00', [eaten(opt.items[0], 150, 690)])],
      }),
    );
    expect(within.slots[2].slotEnergy?.status).toBe('WITHIN');
    const above = computeDayView(
      dayInput(p.slots, {
        targets: p.targets,
        meals: [meal(p.lunch.id, opt.id, '13:00', [eaten(opt.items[0], 150, 790)])],
      }),
    );
    expect(above.slots[2].slotEnergy).toMatchObject({
      status: 'ABOVE',
      band: 'NOTICEABLE',
      difference: 70,
    });
    expect(above.slots[2].score?.score).toBe(within.slots[2].score?.score);
  });
});
