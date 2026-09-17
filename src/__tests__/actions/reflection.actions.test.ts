import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { ServiceError } from '@/lib/errors';
import { t } from '@/lib/t';

vi.mock('@/services/reflection.service', () => ({
  getOrCreateMessage: vi.fn(),
  updateMessage: vi.fn(),
  setCollapsed: vi.fn(),
}));
vi.mock('@/services/analytics.service', () => ({ recordEvent: vi.fn(async () => {}) }));
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

import { recordEvent } from '@/services/analytics.service';
import * as reflections from '@/services/reflection.service';
import {
  getMorningMessageAction,
  setReflectionCollapsedAction,
  updateReflectionAction,
} from '@/actions/reflection.actions';

const ready = {
  status: 'READY' as const,
  paragraph: 'Good morning, Sara.',
  stale: false,
  collapsed: false,
  isFallback: false,
  localDate: '2026-09-17',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getMorningMessageAction', () => {
  it('validates the date', async () => {
    const result = await getMorningMessageAction('tomorrow');
    expect(result.ok).toBe(false);
    expect(reflections.getOrCreateMessage).not.toHaveBeenCalled();
  });

  it('returns the card and records an open for a READY message', async () => {
    vi.mocked(reflections.getOrCreateMessage).mockResolvedValue(ready);
    const result = await getMorningMessageAction('2026-09-17');
    expect(result).toEqual({ ok: true, data: ready });
    expect(reflections.getOrCreateMessage).toHaveBeenCalledWith(
      'u1',
      '2026-09-17',
      expect.any(Date),
    );
    expect(recordEvent).toHaveBeenCalledWith('reflection_opened', { isFallback: false }, 'u1');
  });

  it('returns GENERATING for the client to poll, without an open event', async () => {
    vi.mocked(reflections.getOrCreateMessage).mockResolvedValue({
      ...ready,
      status: 'GENERATING',
      paragraph: null,
    });
    const result = await getMorningMessageAction('2026-09-17');
    expect(result.ok && result.data.status).toBe('GENERATING');
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

describe('updateReflectionAction', () => {
  it('regenerates, records the update and revalidates', async () => {
    vi.mocked(reflections.updateMessage).mockResolvedValue({ ...ready, isFallback: true });
    const result = await updateReflectionAction('2026-09-17');
    expect(result.ok).toBe(true);
    expect(recordEvent).toHaveBeenCalledWith('reflection_updated', { isFallback: true }, 'u1');
    expect(revalidatePath).toHaveBeenCalledWith('/today');
    expect(revalidatePath).toHaveBeenCalledWith('/history/2026-09-17');
  });

  it('maps the daily cap to its message', async () => {
    vi.mocked(reflections.updateMessage).mockRejectedValue(
      new ServiceError(t('reflection.errors.dailyCap'), 'DAILY_AI_CAP'),
    );
    const result = await updateReflectionAction('2026-09-17');
    expect(result).toMatchObject({ ok: false, error: t('reflection.errors.dailyCap') });
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

describe('setReflectionCollapsedAction', () => {
  it('validates both arguments and persists the choice', async () => {
    expect((await setReflectionCollapsedAction('2026-09-17', 'yes')).ok).toBe(false);
    expect((await setReflectionCollapsedAction('nope', true)).ok).toBe(false);
    expect(reflections.setCollapsed).not.toHaveBeenCalled();

    const result = await setReflectionCollapsedAction('2026-09-17', true);
    expect(result.ok).toBe(true);
    expect(reflections.setCollapsed).toHaveBeenCalledWith('u1', '2026-09-17', true);
  });
});
