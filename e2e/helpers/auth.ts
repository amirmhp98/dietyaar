import type { Page } from '@playwright/test';
import { t } from '../../src/lib/t';

export const ADMIN = {
  username: process.env.TEST_USERNAME ?? 'admin',
  password: process.env.TEST_PASSWORD ?? 'admin123',
};

/** Fill the login form and wait for the dashboard. */
export async function login(page: Page, username = ADMIN.username, password = ADMIN.password) {
  await page.goto('/login');
  await page.getByLabel(t('auth.login.username')).fill(username);
  await page.getByLabel(t('auth.login.password'), { exact: true }).fill(password);
  await page.getByRole('button', { name: t('auth.login.submit') }).click();
  await page.waitForURL('/');
}

/** Log out through the header user menu. */
export async function logout(page: Page) {
  await page.getByTestId('user-menu').click();
  await page.getByRole('menuitem', { name: t('auth.logout') }).click();
  await page.waitForURL('/login');
}
