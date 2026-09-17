import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { ServiceError } from '@/lib/errors';
import { PLAN_TEXT_MAX } from '@/lib/validations/plan';

vi.mock('next/server', () => ({ after: vi.fn((fn: () => unknown) => fn()) }));
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(async () => ({
    id: 'user-1',
    username: 'sara',
    fullName: null,
    role: 'USER',
    isActive: true,
    onboardingStep: 'REVIEW',
  })),
}));
vi.mock('@/services/plan.service', () => ({
  startImport: vi.fn(),
  getImportStatus: vi.fn(),
  retryImport: vi.fn(),
  cancelImport: vi.fn(),
  startManual: vi.fn(),
  updateDraft: vi.fn(),
  startEdit: vi.fn(),
  estimateDraftBaseline: vi.fn(),
  getPlan: vi.fn(),
  confirmPlan: vi.fn(),
  discardDraft: vi.fn(),
  deletePlan: vi.fn(),
}));
vi.mock('@/services/profile.service', () => ({ setOnboardingStep: vi.fn() }));
vi.mock('@/services/jobs/scheduler', () => ({ runJobsNow: vi.fn(async () => {}) }));
vi.mock('@/services/jobs/plan-import.job', () => ({ PLAN_IMPORT_TASK: 'plan-import' }));

import { requireAuth } from '@/lib/auth';
import { runJobsNow } from '@/services/jobs/scheduler';
import * as plans from '@/services/plan.service';
import { setOnboardingStep } from '@/services/profile.service';
import {
  confirmPlanAction,
  deletePlanAction,
  getPlanDraftAction,
  getPlanImportStatusAction,
  startManualPlanAction,
  startPlanImportAction,
  updatePlanDraftAction,
} from '@/actions/plan.actions';

beforeEach(() => vi.clearAllMocks());

describe('startPlanImportAction', () => {
  it('authorises, validates, starts the import and kicks the job runner after the response', async () => {
    vi.mocked(plans.startImport).mockResolvedValue({ jobId: 'job-1', draftId: 'd1' });
    const result = await startPlanImportAction({ sourceText: 'صبحانه: تخم‌مرغ' });
    expect(requireAuth).toHaveBeenCalled();
    expect(plans.startImport).toHaveBeenCalledWith('user-1', 'صبحانه: تخم‌مرغ');
    expect(after).toHaveBeenCalled();
    expect(runJobsNow).toHaveBeenCalledWith('plan-import');
    expect(revalidatePath).toHaveBeenCalledWith('/plan');
    expect(revalidatePath).toHaveBeenCalledWith('/today');
    expect(revalidatePath).toHaveBeenCalledWith('/onboarding');
    expect(result).toEqual({ ok: true, data: { jobId: 'job-1' } });
  });

  it('refuses over-limit text before touching the service', async () => {
    const result = await startPlanImportAction({ sourceText: 'x'.repeat(PLAN_TEXT_MAX + 1) });
    expect(result.ok).toBe(false);
    expect(plans.startImport).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it('turns a ServiceError into a failed result', async () => {
    vi.mocked(plans.startImport).mockRejectedValue(
      new ServiceError('too long', 'PLAN_TEXT_TOO_LONG'),
    );
    const result = await startPlanImportAction({ sourceText: 'x' });
    expect(result).toMatchObject({ ok: false, error: 'too long', code: 'PLAN_TEXT_TOO_LONG' });
  });
});

describe('getPlanImportStatusAction', () => {
  it('returns the status', async () => {
    vi.mocked(plans.getImportStatus).mockResolvedValue({ state: 'PENDING', errorCategory: null });
    expect(await getPlanImportStatusAction()).toEqual({
      ok: true,
      data: { state: 'PENDING', errorCategory: null },
    });
  });
});

describe('startManualPlanAction', () => {
  it('validates the structure and passes a null name when empty', async () => {
    vi.mocked(plans.startManual).mockResolvedValue({} as never);
    await startManualPlanAction({ structure: 'TARGETS_ONLY', name: '' });
    expect(plans.startManual).toHaveBeenCalledWith('user-1', 'TARGETS_ONLY', null);
    const bad = await startManualPlanAction({ structure: 'WEEKLY' });
    expect(bad.ok).toBe(false);
  });
});

describe('updatePlanDraftAction', () => {
  it('validates the section payload and forwards the revision', async () => {
    vi.mocked(plans.updateDraft).mockResolvedValue({ draftRevision: 2 } as never);
    const result = await updatePlanDraftAction({
      section: 'meta',
      payload: { name: 'برنامه من' },
      draftRevision: 1,
    });
    expect(plans.updateDraft).toHaveBeenCalledWith('user-1', 'meta', { name: 'برنامه من' }, 1);
    expect(result.ok).toBe(true);
  });

  it('rejects an invalid payload for the section with field errors', async () => {
    const result = await updatePlanDraftAction({
      section: 'targets',
      payload: [{ key: 'k', nutrient: 'ENERGY_KCAL', type: 'RANGE', low: 900, high: 100 }],
      draftRevision: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.['0.low']).toBeDefined();
    expect(plans.updateDraft).not.toHaveBeenCalled();
  });
});

describe('getPlanDraftAction', () => {
  it('returns the draft from the plan view, or null', async () => {
    vi.mocked(plans.getPlan).mockResolvedValue({ draftJson: { draftRevision: 3 } } as never);
    expect(await getPlanDraftAction()).toEqual({ ok: true, data: { draftRevision: 3 } });
    vi.mocked(plans.getPlan).mockResolvedValue(null);
    expect(await getPlanDraftAction()).toEqual({ ok: true, data: null });
  });
});

describe('confirmPlanAction', () => {
  it('confirms, advances onboarding from REVIEW to READY and returns the affected count', async () => {
    vi.mocked(plans.confirmPlan).mockResolvedValue({ affectedMeals: 3 });
    const result = await confirmPlanAction({ draftRevision: 2 });
    expect(plans.confirmPlan).toHaveBeenCalledWith('user-1', 2);
    expect(setOnboardingStep).toHaveBeenCalledWith('user-1', 'READY');
    expect(revalidatePath).toHaveBeenCalledWith('/history');
    expect(result).toEqual({ ok: true, data: { affectedMeals: 3 } });
  });

  it('leaves the onboarding pointer alone for a DONE user', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'user-1',
      username: 'sara',
      fullName: null,
      role: 'USER',
      isActive: true,
      onboardingStep: 'DONE',
    });
    vi.mocked(plans.confirmPlan).mockResolvedValue({ affectedMeals: 0 });
    await confirmPlanAction({ draftRevision: 0 });
    expect(setOnboardingStep).not.toHaveBeenCalled();
  });

  it('surfaces CONFLICT from the service', async () => {
    vi.mocked(plans.confirmPlan).mockRejectedValue(new ServiceError('stale', 'CONFLICT'));
    expect(await confirmPlanAction({ draftRevision: 0 })).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
  });
});

describe('deletePlanAction', () => {
  it('requires a confirmation string and calls the service', async () => {
    expect((await deletePlanAction({ confirmation: '' })).ok).toBe(false);
    vi.mocked(plans.deletePlan).mockResolvedValue();
    expect(await deletePlanAction({ confirmation: 'برنامه من' })).toEqual({
      ok: true,
      data: undefined,
    });
    expect(plans.deletePlan).toHaveBeenCalledWith('user-1', 'برنامه من');
  });
});
