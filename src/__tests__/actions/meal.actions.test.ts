import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { ServiceError } from '@/lib/errors';
import { t } from '@/lib/t';

vi.mock('@/services/meal.service', () => ({
  createDraft: vi.fn(),
  analyzeDraft: vi.fn(),
  updateDraft: vi.fn(),
  saveMeal: vi.fn(),
  updateMeal: vi.fn(),
  deleteMeal: vi.fn(),
  setMealLink: vi.fn(),
  reuseMeal: vi.fn(),
  getDraft: vi.fn(),
  listRecentMeals: vi.fn(),
}));
vi.mock('@/services/analytics.service', () => ({ recordEvent: vi.fn() }));
vi.mock('@/services/upload.service', () => ({ removeUpload: vi.fn() }));
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
import * as meals from '@/services/meal.service';
import { removeUpload } from '@/services/upload.service';
import {
  analyzeMealDraftAction,
  createMealDraftAction,
  deleteMealAction,
  getRecentMealsAction,
  removeMealPhotoAction,
  saveMealAction,
  updateMealAction,
  updateMealDraftAction,
} from '@/actions/meal.actions';

const REQ = '11111111-1111-4111-8111-111111111111';
const mealView = { id: 'm1', inputKind: 'TEXT', planSlotId: null, items: [] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createMealDraftAction', () => {
  it('validates before calling the service', async () => {
    const result = await createMealDraftAction({ clientRequestId: 'nope', kind: 'TEXT' });
    expect(result.ok).toBe(false);
    expect(meals.createDraft).not.toHaveBeenCalled();
  });

  it('creates the draft for the signed-in user and records the event without content', async () => {
    vi.mocked(meals.createDraft).mockResolvedValue({ draft: { id: 'd1' }, meal: null } as never);
    const result = await createMealDraftAction({
      clientRequestId: REQ,
      kind: 'TEXT',
      text: 'two eggs',
      localDate: '2026-09-17',
    });
    expect(result.ok).toBe(true);
    expect(vi.mocked(meals.createDraft).mock.calls[0]?.[0]).toBe('u1');
    expect(vi.mocked(meals.createDraft).mock.calls[0]?.[1]).toMatchObject({ text: 'two eggs' });
    expect(recordEvent).toHaveBeenCalledWith('meal_draft_created', { kind: 'TEXT' }, 'u1');
  });
});

describe('analyzeMealDraftAction', () => {
  it('returns the typed AI failure code and records analysis_failed', async () => {
    vi.mocked(meals.analyzeDraft).mockRejectedValue(
      new ServiceError(t('meal.errors.aiTimeout'), 'AI_TIMEOUT'),
    );
    const result = await analyzeMealDraftAction({ draftId: 'd1', expectedRevision: 1 });
    expect(result).toMatchObject({
      ok: false,
      code: 'AI_TIMEOUT',
      error: t('meal.errors.aiTimeout'),
    });
    expect(recordEvent).toHaveBeenCalledWith(
      'analysis_failed',
      expect.objectContaining({ reason: 'AI_TIMEOUT' }),
      'u1',
    );
  });

  it('records analysis_succeeded on DONE', async () => {
    vi.mocked(meals.analyzeDraft).mockResolvedValue({
      analysisStatus: 'DONE',
      analysisFailureReason: null,
      state: { kind: 'TEXT' },
    } as never);
    const result = await analyzeMealDraftAction({ draftId: 'd1', expectedRevision: 1 });
    expect(result.ok).toBe(true);
    expect(vi.mocked(recordEvent).mock.calls[0]?.[0]).toBe('analysis_succeeded');
  });
});

describe('updateMealDraftAction', () => {
  it('passes the revision and edits through', async () => {
    vi.mocked(meals.updateDraft).mockResolvedValue({
      draft: {},
      preview: { match: null },
    } as never);
    const result = await updateMealDraftAction({
      draftId: 'd1',
      expectedRevision: 2,
      edits: { notes: 'late' },
    });
    expect(result.ok).toBe(true);
    expect(meals.updateDraft).toHaveBeenCalledWith(
      'u1',
      'd1',
      2,
      { notes: 'late' },
      expect.any(Date),
    );
  });
});

describe('saveMealAction', () => {
  it('saves, revalidates Today, History and the meal page, and records the success', async () => {
    vi.mocked(meals.saveMeal).mockResolvedValue(mealView as never);
    const result = await saveMealAction({
      draftId: 'd1',
      expectedRevision: 1,
      clientRequestId: REQ,
    });
    expect(result.ok).toBe(true);
    expect(meals.saveMeal).toHaveBeenCalledWith('u1', 'd1', 1, REQ, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/today');
    expect(revalidatePath).toHaveBeenCalledWith('/history');
    expect(revalidatePath).toHaveBeenCalledWith('/meals/m1');
    expect(recordEvent).toHaveBeenCalledWith(
      'meal_save_succeeded',
      { kind: 'TEXT', linked: false, items: 0 },
      'u1',
    );
  });

  it('surfaces CONFLICT with the current revision and records meal_save_conflict', async () => {
    vi.mocked(meals.saveMeal).mockRejectedValue(
      new ServiceError(t('meal.errors.conflict'), 'CONFLICT', { currentRevision: 3 }),
    );
    const result = await saveMealAction({
      draftId: 'd1',
      expectedRevision: 1,
      clientRequestId: REQ,
    });
    expect(result).toEqual({
      ok: false,
      error: t('meal.errors.conflict'),
      code: 'CONFLICT',
      details: { currentRevision: 3 },
    });
    expect(recordEvent).toHaveBeenCalledWith('meal_save_conflict', { code: 'CONFLICT' }, 'u1');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('surfaces OPTION_REQUIRED as a typed failure', async () => {
    vi.mocked(meals.saveMeal).mockRejectedValue(
      new ServiceError(t('meal.errors.optionRequired'), 'OPTION_REQUIRED'),
    );
    const result = await saveMealAction({
      draftId: 'd1',
      expectedRevision: 1,
      clientRequestId: REQ,
    });
    expect(result).toMatchObject({ ok: false, code: 'OPTION_REQUIRED' });
  });
});

describe('updateMealAction / deleteMealAction', () => {
  it('rejects a future date at validation time', async () => {
    const result = await updateMealAction({
      mealId: 'm1',
      expectedRevision: 1,
      edits: { localDate: '2026-13-01' },
    });
    expect(result.ok).toBe(false);
    expect(meals.updateMeal).not.toHaveBeenCalled();
  });

  it('deletes with the expected revision and records meal_deleted', async () => {
    vi.mocked(meals.deleteMeal).mockResolvedValue();
    const result = await deleteMealAction({ mealId: 'm1', expectedRevision: 2 });
    expect(result.ok).toBe(true);
    expect(meals.deleteMeal).toHaveBeenCalledWith('u1', 'm1', 2);
    expect(recordEvent).toHaveBeenCalledWith('meal_deleted', {}, 'u1');
    expect(revalidatePath).toHaveBeenCalledWith('/meals/m1');
  });
});

describe('removeMealPhotoAction / getRecentMealsAction', () => {
  it('removes the upload for the owner', async () => {
    const result = await removeMealPhotoAction({ uploadId: 'up-1' });
    expect(result.ok).toBe(true);
    expect(removeUpload).toHaveBeenCalledWith('u1', 'up-1');
  });

  it('lists recent meals for the owner', async () => {
    vi.mocked(meals.listRecentMeals).mockResolvedValue([]);
    const result = await getRecentMealsAction();
    expect(result).toEqual({ ok: true, data: [] });
    expect(meals.listRecentMeals).toHaveBeenCalledWith('u1');
  });
});
