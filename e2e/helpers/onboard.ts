import type { Page } from '@playwright/test';
import { t } from '../../src/lib/t';
import { signUp, uniqueUsername } from './auth';

/**
 * Sign up a fresh user and complete the six profile questions; ends on the
 * plan step. With `skipPlan` it lands on Today with no plan. Returns the
 * username so a spec can seed data for it (see helpers/db.ts).
 */
export async function createOnboardedUser(
  page: Page,
  options: { skipPlan?: boolean; prefix?: string } = {},
) {
  const username = uniqueUsername(options.prefix ?? 'e2e');
  await signUp(page, username);
  await page.getByLabel(t('onboarding.age.label')).fill('30');
  await page.getByRole('button', { name: t('onboarding.continue') }).click();
  await page.getByRole('radio', { name: t('onboarding.sex.FEMALE') }).click();
  await page.getByLabel(t('onboarding.height.cm')).fill('168');
  await page.getByRole('button', { name: t('onboarding.continue') }).click();
  await page.getByLabel(t('onboarding.weight.kg')).fill('64');
  await page.getByRole('button', { name: t('onboarding.continue') }).click();
  await page.getByRole('button', { name: t('onboarding.timeZone.looksRight') }).click();
  await page.getByRole('button', { name: t('onboarding.skip') }).click();
  await page.waitForURL(/\/onboarding\/plan/);
  if (options.skipPlan) {
    await page.getByRole('button', { name: t('onboarding.plan.noPlanYet') }).click();
    await page.waitForURL(/\/today/);
  }
  return username;
}
