import { describe, expect, it } from 'vitest';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { profileFactory, userFactory } from '@/__tests__/factories';
import {
  getOnboardingState,
  greetingNameFor,
  saveOnboardingStep,
  setOnboardingStep,
  toProfileView,
  updatePreferences,
  updateProfile,
} from '@/services/profile.service';

resetPrismaMock();

describe('saveOnboardingStep', () => {
  it('never writes an age under 18 and creates no profile', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...userFactory.build({ onboardingStep: 'AGE' }),
      profile: null,
    } as never);
    const result = await saveOnboardingStep('u1', 'AGE', { ageYears: 17 });
    expect(result).toEqual({ underage: true });
    expect(prismaMock.profile.upsert).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('creates the profile row at the AGE step and advances to SEX', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...userFactory.build({ onboardingStep: 'AGE' }),
      profile: null,
    } as never);
    prismaMock.profile.upsert.mockResolvedValue(
      profileFactory.build({
        ageYears: 29,
        sex: null,
        heightCm: null,
        weightKg: null,
        timeZone: null,
        completedAt: null,
      }),
    );
    prismaMock.$transaction.mockResolvedValue([]);
    const result = await saveOnboardingStep('u1', 'AGE', { ageYears: 29 });
    expect(result).toEqual({ nextStep: 'SEX' });
    expect(prismaMock.profile.upsert.mock.calls[0]?.[0].create).toMatchObject({
      userId: 'u1',
      ageYears: 29,
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { onboardingStep: 'SEX' },
    });
  });

  it('refuses later steps before the age row exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...userFactory.build({ onboardingStep: 'AGE' }),
      profile: null,
    } as never);
    await expect(saveOnboardingStep('u1', 'SEX', { sex: 'MALE' })).rejects.toMatchObject({
      code: 'AGE_FIRST',
    });
  });

  it('keeps the resume pointer when an earlier step is re-answered on Back', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...userFactory.build({ onboardingStep: 'WEIGHT' }),
      profile: { id: 'p' },
    } as never);
    prismaMock.profile.upsert.mockResolvedValue(profileFactory.build({ completedAt: null }));
    prismaMock.$transaction.mockResolvedValue([]);
    const result = await saveOnboardingStep('u1', 'SEX', { sex: 'MALE' });
    expect(result).toEqual({ nextStep: 'WEIGHT' });
  });

  it('sets completedAt only at the display-name step when the five required fields exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...userFactory.build({ onboardingStep: 'DISPLAY_NAME' }),
      profile: { id: 'p' },
    } as never);
    prismaMock.profile.upsert.mockResolvedValue(profileFactory.build({ completedAt: null }));
    prismaMock.$transaction.mockResolvedValue([]);
    await saveOnboardingStep(
      'u1',
      'DISPLAY_NAME',
      { displayName: null },
      new Date('2026-09-17T10:00:00Z'),
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { onboardingStep: 'PLAN' },
    });
    expect(prismaMock.profile.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { completedAt: new Date('2026-09-17T10:00:00Z') },
    });
  });

  it('stamps the weight measurement date in the profile zone once the zone is known', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...userFactory.build({ onboardingStep: 'TIME_ZONE' }),
      profile: { id: 'p' },
    } as never);
    prismaMock.profile.upsert.mockResolvedValue(
      profileFactory.build({ timeZone: 'Asia/Tehran', weightMeasuredAt: null, completedAt: null }),
    );
    prismaMock.$transaction.mockResolvedValue([]);
    await saveOnboardingStep(
      'u1',
      'TIME_ZONE',
      { timeZone: 'Asia/Tehran' },
      new Date('2026-09-16T21:00:00Z'),
    );
    expect(prismaMock.profile.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { weightMeasuredAt: '2026-09-17' },
    });
  });
});

describe('setOnboardingStep', () => {
  it('refuses to move past the profile steps without a completed profile', async () => {
    prismaMock.profile.findUnique.mockResolvedValue({ completedAt: null } as never);
    await expect(setOnboardingStep('u1', 'DONE')).rejects.toMatchObject({
      code: 'PROFILE_INCOMPLETE',
    });
    prismaMock.profile.findUnique.mockResolvedValue({ completedAt: new Date() } as never);
    await setOnboardingStep('u1', 'DONE');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { onboardingStep: 'DONE' },
    });
  });
});

describe('read model', () => {
  it('getOnboardingState returns the step and saved values as numbers', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      onboardingStep: 'HEIGHT',
      profile: profileFactory.build({ ageYears: 31, heightCm: null }),
    } as never);
    const state = await getOnboardingState('u1');
    expect(state.step).toBe('HEIGHT');
    expect(state.values).toMatchObject({
      ageYears: 31,
      heightCm: null,
      weightKg: 64,
      timeZone: 'Asia/Tehran',
    });
  });

  it('greeting falls back to the username; profile view converts decimals and defaults', () => {
    expect(greetingNameFor({ displayName: ' ' }, { username: 'sara' })).toBe('sara');
    expect(greetingNameFor({ displayName: 'سارا' }, { username: 'sara' })).toBe('سارا');
    const view = toProfileView(profileFactory.build({ timeZone: null, weekStart: null }));
    expect(view).toMatchObject({ heightCm: 168, weightKg: 64, timeZone: 'UTC', weekStart: 6 });
  });
});

describe('settings', () => {
  it('updateProfile stores restrictions verbatim plus normalised copies', async () => {
    prismaMock.profile.findUnique.mockResolvedValue(profileFactory.build());
    prismaMock.profile.update.mockResolvedValue(profileFactory.build());
    await updateProfile('u1', {
      ageYears: 30,
      sex: 'FEMALE',
      heightCm: 168,
      weightKg: 64,
      weightMeasuredAt: '2026-09-17',
      displayName: null,
      goal: null,
      restrictions: [' Walnuts ', 'گردو', ''],
    });
    expect(prismaMock.profile.update.mock.calls[0]?.[0].data).toMatchObject({
      restrictionsOriginal: ['Walnuts', 'گردو'],
      restrictions: ['walnuts', 'گردو'],
      weightMeasuredAt: '2026-09-17',
    });
  });

  it('updatePreferences writes only the given fields and clears the zone hint on a zone change', async () => {
    prismaMock.profile.findUnique.mockResolvedValue(profileFactory.build());
    prismaMock.profile.update.mockResolvedValue(profileFactory.build({ appearance: 'DARK' }));
    const view = await updatePreferences('u1', { appearance: 'DARK', timeZone: 'Europe/Berlin' });
    expect(prismaMock.profile.update.mock.calls[0]?.[0].data).toEqual({
      appearance: 'DARK',
      timeZone: 'Europe/Berlin',
      lastSeenDeviceTimeZone: null,
      timeZoneHintDismissedAt: null,
    });
    expect(view.appearance).toBe('DARK');
  });
});
