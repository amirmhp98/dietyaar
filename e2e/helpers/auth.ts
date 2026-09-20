import type { Page } from '@playwright/test';
import { t } from '../../src/lib/t';

/** Seeded accounts (prisma/seed.ts). `demo` is onboarded. */
export const ADMIN = {
  username: process.env.TEST_ADMIN_USERNAME ?? 'admin',
  password: process.env.TEST_ADMIN_PASSWORD ?? 'admin123',
};
export const DEMO = {
  username: process.env.TEST_USERNAME ?? 'demo',
  password: process.env.TEST_PASSWORD ?? 'demo1234',
};

/** Fill the login form and wait for Today. */
export async function login(page: Page, username = DEMO.username, password = DEMO.password) {
  await page.goto('/login');
  await page.getByLabel(t('auth.login.username')).fill(username);
  await page.getByLabel(t('auth.login.password'), { exact: true }).fill(password);
  await page.getByRole('button', { name: t('auth.login.submit') }).click();
  await page.waitForURL(/\/(today|onboarding)/);
}

/** Log out through Settings › Log out. */
export async function logout(page: Page) {
  await page.goto('/settings');
  await page.getByTestId('logout').click();
  await page.waitForURL('/login');
}

/** Create a fresh account through the sign-up form; lands on /onboarding. */
export async function signUp(page: Page, username: string, password = 'correct-horse-9') {
  await page.goto('/signup');
  await page.getByLabel(t('signup.username')).fill(username);
  await page.getByLabel(t('signup.password'), { exact: true }).fill(password);
  await page.getByRole('button', { name: t('signup.submit') }).click();
  await page.waitForURL('/onboarding');
}

export function uniqueUsername(prefix = 'e2e') {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}
