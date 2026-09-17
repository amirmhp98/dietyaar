import { expect, test } from '@playwright/test';
import { t } from '../src/lib/t';
import { signUp, uniqueUsername } from './helpers/auth';

test.describe('sign-up', () => {
  test('creates an account, states no recovery, lands on onboarding', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByText(t('auth.noRecovery'))).toBeVisible();
    await signUp(page, uniqueUsername());
    await expect(page.getByRole('heading', { name: t('onboarding.age.title') })).toBeVisible();
  });

  test('a taken username is refused case-insensitively', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel(t('signup.username')).fill('DEMO');
    await page.getByLabel(t('signup.password'), { exact: true }).fill('correct-horse-9');
    await page.getByRole('button', { name: t('signup.submit') }).click();
    await expect(page.getByTestId('signup-error')).toContainText(t('signup.errors.usernameTaken'));
  });

  test('a common password is refused', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel(t('signup.username')).fill(uniqueUsername());
    await page.getByLabel(t('signup.password'), { exact: true }).fill('password1');
    await page.getByRole('button', { name: t('signup.submit') }).click();
    await expect(page.getByTestId('signup-error')).toContainText(t('validation.passwordCommon'));
  });
});
