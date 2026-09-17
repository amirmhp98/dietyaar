import { expect, test } from '@playwright/test';
import { t } from '../src/lib/t';
import { DEMO, login, logout } from './helpers/auth';

test.describe('authentication', () => {
  test('anonymous visitors are sent to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: t('auth.login.title') })).toBeVisible();
  });

  test('sign-up is public without a cookie', async ({ request }) => {
    expect((await request.get('/signup', { maxRedirects: 0 })).status()).toBe(200);
  });

  test('wrong password shows an error and stays on /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(t('auth.login.username')).fill(DEMO.username);
    await page.getByLabel(t('auth.login.password'), { exact: true }).fill('definitely-wrong');
    await page.getByRole('button', { name: t('auth.login.submit') }).click();

    await expect(page.getByTestId('login-error')).toContainText(
      t('auth.errors.invalidCredentials'),
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test('valid login lands on Today and logout returns to /login', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await logout(page);
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a stale session cookie shows the login page instead of looping', async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: 'session', value: 'stale-token', domain: 'localhost', path: '/' },
    ]);
    await page.goto('/today');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: t('auth.login.title') })).toBeVisible();
  });
});
