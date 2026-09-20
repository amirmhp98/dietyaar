import { expect, test } from '@playwright/test';
import { t } from '../src/lib/t';
import { signUp, uniqueUsername } from './helpers/auth';

test.describe('onboarding', () => {
  test('J1: answers one question per screen, resumes after a refresh, reaches the plan step', async ({
    page,
  }) => {
    await signUp(page, uniqueUsername());

    // Step 1: the question is the heading, the progress bar is truthful, nothing before it to go back to.
    await expect(page.getByRole('heading', { name: t('onboarding.age.title') })).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
    await expect(page.getByRole('button', { name: t('onboarding.back') })).toHaveCount(0);
    await page.getByLabel(t('onboarding.age.label')).fill('۲۹');
    await page.getByRole('button', { name: t('onboarding.continue') }).click();
    // Back is on every later step (B16).
    await expect(page.getByRole('button', { name: t('onboarding.back') })).toBeVisible();
    await page.getByRole('radio', { name: t('onboarding.sex.FEMALE') }).click();
    await expect(page.getByRole('heading', { name: t('onboarding.height.title') })).toBeVisible();

    // Refresh mid-way: the same step with the resume pointer intact.
    await page.reload();
    await expect(page.getByRole('heading', { name: t('onboarding.height.title') })).toBeVisible();

    await page.getByLabel(t('onboarding.height.cm')).fill('168');
    // Switching units converts the displayed value without reinterpreting it.
    await page.getByRole('radio', { name: t('onboarding.units.imperial') }).click();
    await expect(page.getByLabel(t('onboarding.height.ft'))).toHaveValue('5');
    await page.getByRole('radio', { name: t('onboarding.units.metric') }).click();
    await expect(page.getByLabel(t('onboarding.height.cm'))).toHaveValue(/^168/);
    await page.getByRole('button', { name: t('onboarding.continue') }).click();

    await page.getByLabel(t('onboarding.weight.kg')).fill('64');
    await page.getByRole('button', { name: t('onboarding.continue') }).click();
    // No time-zone step (decision 022): weight goes straight to the name.
    await expect(page.getByText(t('onboarding.progress', { current: 5, total: 10 }))).toBeVisible();
    await page.getByLabel(t('onboarding.name.label')).fill('سارا');
    await page.getByRole('button', { name: t('onboarding.continue') }).click();

    await expect(page).toHaveURL(/\/onboarding\/plan$/);
  });

  test('an age under 18 stops onboarding and deletes the account in one tap', async ({ page }) => {
    const username = uniqueUsername('minor');
    await signUp(page, username);
    await page.getByLabel(t('onboarding.age.label')).fill('17');
    await page.getByRole('button', { name: t('onboarding.continue') }).click();
    await expect(page.getByRole('heading', { name: t('onboarding.age.stopTitle') })).toBeVisible();
    await page.getByRole('button', { name: t('onboarding.age.deleteAccount') }).click();
    await expect(page).toHaveURL(/\/signup$/);

    // The account is gone: signing in fails.
    await page.goto('/login');
    await page.getByLabel(t('auth.login.username')).fill(username);
    await page.getByLabel(t('auth.login.password'), { exact: true }).fill('correct-horse-9');
    await page.getByRole('button', { name: t('auth.login.submit') }).click();
    await expect(page.getByTestId('login-error')).toBeVisible();
  });
});
