import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/t';
import { ADMIN, login } from './helpers/auth';

/**
 * Exercises the reference Users module end-to-end as the seeded admin.
 * Each run creates a uniquely named user so the suite is re-runnable.
 */
const stamp = Date.now().toString(36);
const newUser = {
  username: `e2e_${stamp}`,
  fullName: `E2E ${stamp}`,
  password: 'e2e-password-1',
};

function row(page: Page) {
  return page.getByTestId(`user-row-${newUser.username}`);
}

function rowMenu(page: Page, rowLocator = row(page)) {
  return rowLocator.getByRole('button', { name: t('users.rowActions', { name: '' }).trim() });
}

// The stored state belongs to the demo user; this suite signs in as the admin itself.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe.serial('admin › users', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.username, ADMIN.password);
  });

  test('the users page lists the seeded admin', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: t('users.title') })).toBeVisible();
    await expect(page.getByTestId('user-row-admin')).toContainText(t('users.you'));
  });

  test('create a user through the dialog', async ({ page }) => {
    await page.goto('/admin/users');
    await page.getByRole('button', { name: t('users.action.new') }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(t('users.field.fullName')).fill(newUser.fullName);
    await dialog.getByLabel(t('users.field.username')).fill(newUser.username);
    await dialog.getByLabel(t('users.field.password')).fill(newUser.password);
    await dialog.getByRole('button', { name: t('users.action.create') }).click();

    await expect(dialog).toBeHidden();
    await expect(row(page)).toBeVisible();
    await expect(row(page)).toContainText(t('users.role.USER'));
    await expect(row(page)).toContainText(t('users.status.active'));
  });

  test('client-side validation blocks a short password', async ({ page }) => {
    await page.goto('/admin/users');
    await page.getByRole('button', { name: t('users.action.new') }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(t('users.field.fullName')).fill('Someone');
    await dialog.getByLabel(t('users.field.username')).fill(`x_${stamp}`);
    await dialog.getByLabel(t('users.field.password')).fill('123');
    await dialog.getByRole('button', { name: t('users.action.create') }).click();

    await expect(dialog.getByText(t('validation.passwordMin', { min: 8 }))).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('edit changes the name and role', async ({ page }) => {
    await page.goto('/admin/users');
    await rowMenu(page).click();
    await page.getByRole('menuitem', { name: t('users.action.edit') }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(t('users.field.fullName')).fill(`${newUser.fullName} edited`);
    await dialog.getByLabel(t('users.field.role')).click();
    await page.getByRole('option', { name: t('users.role.ADMIN') }).click();
    await dialog.getByRole('button', { name: t('users.action.save') }).click();

    await expect(dialog).toBeHidden();
    await expect(row(page)).toContainText('edited');
    await expect(row(page)).toContainText(t('users.role.ADMIN'));
  });

  test('reset password closes the dialog with a success toast', async ({ page }) => {
    await page.goto('/admin/users');
    await rowMenu(page).click();
    await page.getByRole('menuitem', { name: t('users.action.resetPassword') }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(t('users.field.newPassword')).fill('another-password-2');
    await dialog.getByRole('button', { name: t('users.action.reset') }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(t('users.toast.passwordReset'))).toBeVisible();
  });

  test('deactivate flips the status badge; the admin cannot deactivate themselves', async ({
    page,
  }) => {
    await page.goto('/admin/users');
    await rowMenu(page).click();
    await page.getByRole('menuitem', { name: t('users.action.deactivate') }).click();
    await expect(row(page)).toContainText(t('users.status.inactive'));

    await rowMenu(page, page.getByTestId('user-row-admin')).click();
    await expect(page.getByRole('menuitem', { name: t('users.action.deactivate') })).toBeDisabled();
  });
});

// Runs after the serial block above (workers: 1) with no admin cookie.
test.describe('admin › users › deactivated account', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a deactivated user cannot log in', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(t('auth.login.username')).fill(newUser.username);
    await page.getByLabel(t('auth.login.password'), { exact: true }).fill('another-password-2');
    await page.getByRole('button', { name: t('auth.login.submit') }).click();
    await expect(page.getByTestId('login-error')).toContainText(
      t('auth.errors.invalidCredentials'),
    );
  });
});
