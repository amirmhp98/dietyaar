import { expect, test } from '@playwright/test';
import { t } from '../src/lib/t';
import { ADMIN, login, logout } from './helpers/auth';

test.describe('authentication', () => {
  test('anonymous visitors are sent to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: t('auth.login.title') })).toBeVisible();
  });

  test('wrong password shows an error and stays on /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(t('auth.login.username')).fill(ADMIN.username);
    await page.getByLabel(t('auth.login.password'), { exact: true }).fill('definitely-wrong');
    await page.getByRole('button', { name: t('auth.login.submit') }).click();

    await expect(page.getByTestId('login-error')).toContainText(
      t('auth.errors.invalidCredentials'),
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test('valid login lands on the dashboard and logout returns to /login', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { level: 2, name: t('home.title') })).toBeVisible();

    await logout(page);
    await expect(page).toHaveURL(/\/login$/);

    // The session cookie is gone: the dashboard redirects again.
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a stale session cookie shows the login page instead of looping', async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: 'session', value: 'f'.repeat(64), domain: 'localhost', path: '/' },
    ]);
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: t('auth.login.title') })).toBeVisible();

    // And protected pages bounce to /login exactly once.
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('logged-in users visiting /login are redirected home', async ({ page }) => {
    await login(page);
    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });

  test('repeated failures lock the account out for a while', async ({ page }) => {
    const username = `lockout_${Date.now().toString(36)}`;
    await page.goto('/login');
    const submit = page.getByRole('button', { name: t('auth.login.submit') });
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.getByLabel(t('auth.login.username')).fill(username);
      await page.getByLabel(t('auth.login.password'), { exact: true }).fill('wrong');
      await submit.click();
      // React resets the form once the action has returned; that is the settle signal.
      await expect(page.getByLabel(t('auth.login.username'))).toHaveValue('');
      await expect(page.getByTestId('login-error')).toContainText(
        t('auth.errors.invalidCredentials'),
      );
    }
    // React resets the form after each action, so refill both fields.
    await page.getByLabel(t('auth.login.username')).fill(username);
    await page.getByLabel(t('auth.login.password'), { exact: true }).fill('wrong');
    await submit.click();
    await expect(page.getByTestId('login-error')).toContainText(
      t('auth.errors.tooManyAttempts', { minutes: 15 }),
    );
  });
});
