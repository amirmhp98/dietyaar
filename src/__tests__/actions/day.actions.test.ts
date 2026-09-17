import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { ServiceError } from '@/lib/errors';
import { t } from '@/lib/t';

vi.mock('@/services/day-view.service', () => ({
  getDayView: vi.fn(),
  getSevenDayView: vi.fn(),
}));
vi.mock('@/services/day.service', () => ({
  markSlotSkipped: vi.fn(),
  setDayCompleteness: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  requireOnboarded: vi.fn(async () => ({
    id: 'u1',
    username: 'sara',
    onboardingStep: 'DONE',
    role: 'USER',
    isActive: true,
    fullName: null,
  })),
}));

import * as dayView from '@/services/day-view.service';
import * as days from '@/services/day.service';
import {
  getDayAction,
  getSevenDayAction,
  markSlotSkippedAction,
  setDayCompletenessAction,
} from '@/actions/day.actions';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDayAction / getSevenDayAction', () => {
  it('validates the date before reading', async () => {
    const result = await getDayAction('2026-13-40');
    expect(result.ok).toBe(false);
    expect(dayView.getDayView).not.toHaveBeenCalled();
  });

  it('returns the computed view for the owner', async () => {
    vi.mocked(dayView.getDayView).mockResolvedValue({ view: { localDate: '2026-09-16' } } as never);
    const result = await getDayAction('2026-09-16');
    expect(result).toEqual({ ok: true, data: { view: { localDate: '2026-09-16' } } });
    expect(dayView.getDayView).toHaveBeenCalledWith('u1', '2026-09-16', expect.any(Date));
  });

  it('reads seven days ending at the date', async () => {
    vi.mocked(dayView.getSevenDayView).mockResolvedValue({ endDate: '2026-09-17' } as never);
    const result = await getSevenDayAction('2026-09-17');
    expect(result.ok).toBe(true);
    expect(dayView.getSevenDayView).toHaveBeenCalledWith('u1', '2026-09-17', expect.any(Date));
  });
});

describe('markSlotSkippedAction', () => {
  it('validates, calls the service and revalidates Today and History', async () => {
    const result = await markSlotSkippedAction({
      localDate: '2026-09-16',
      planSlotId: 'slot-1',
      skipped: true,
    });
    expect(result).toEqual({ ok: true, data: undefined });
    expect(days.markSlotSkipped).toHaveBeenCalledWith('u1', '2026-09-16', 'slot-1', true);
    expect(revalidatePath).toHaveBeenCalledWith('/today');
    expect(revalidatePath).toHaveBeenCalledWith('/history');
    expect(revalidatePath).toHaveBeenCalledWith('/history/2026-09-16');
  });

  it('rejects invalid input without touching the service', async () => {
    const result = await markSlotSkippedAction({ localDate: 'bad', planSlotId: '', skipped: 1 });
    expect(result.ok).toBe(false);
    expect(days.markSlotSkipped).not.toHaveBeenCalled();
  });

  it('surfaces a ServiceError message', async () => {
    vi.mocked(days.markSlotSkipped).mockRejectedValue(
      new ServiceError(t('meal.errors.slotHasMeal'), 'SLOT_HAS_MEAL'),
    );
    const result = await markSlotSkippedAction({
      localDate: '2026-09-16',
      planSlotId: 'slot-1',
      skipped: true,
    });
    expect(result).toMatchObject({ ok: false, error: t('meal.errors.slotHasMeal') });
  });
});

describe('setDayCompletenessAction', () => {
  it('persists the explicit choice for that date', async () => {
    const result = await setDayCompletenessAction({ localDate: '2026-09-16', complete: false });
    expect(result.ok).toBe(true);
    expect(days.setDayCompleteness).toHaveBeenCalledWith('u1', '2026-09-16', false);
    expect(revalidatePath).toHaveBeenCalledWith('/history/2026-09-16');
  });

  it('rejects a missing flag', async () => {
    const result = await setDayCompletenessAction({ localDate: '2026-09-16' });
    expect(result.ok).toBe(false);
    expect(days.setDayCompleteness).not.toHaveBeenCalled();
  });
});
