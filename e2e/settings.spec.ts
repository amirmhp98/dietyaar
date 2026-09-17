import { expect, test } from '@playwright/test';
import { t } from '../src/lib/t';
import { login } from './helpers/auth';
import { createOnboardedUser } from './helpers/onboard';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('settings', () => {
  test('appearance persists across reload and devices; profile edits save', async ({ page }) => {
    await createOnboardedUser(page, { skipPlan: true, prefix: 'set' });
    await page.goto('/settings');
    await page
      .getByRole('radio', { name: t('settings.preferences.appearance.DARK') })
      .check({ force: true });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: t('settings.edit') }).click();
    await page.getByLabel(t('settings.profile.restrictions')).fill('گردو\nWalnuts');
    await page.getByRole('button', { name: t('settings.save') }).click();
    await expect(page.getByTestId('profile-summary')).toContainText('گردو');
  });

  test('change password signs out another device (J14 account)', async ({ page, browser }) => {
    const username = await createOnboardedUser(page, { skipPlan: true, prefix: 'pw' });

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await login(otherPage, username, 'correct-horse-9');
    await expect(otherPage).toHaveURL(/\/today/);

    await page.goto('/settings');
    await page.getByRole('button', { name: t('settings.account.changePassword') }).click();
    await page.getByLabel(t('settings.account.currentPassword')).fill('correct-horse-9');
    await page.getByLabel(t('settings.account.newPassword')).fill('brand-new-pass-2');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: t('settings.save') })
      .click();
    await expect(page.getByText(t('settings.account.passwordChanged'))).toBeVisible();

    await otherPage.goto('/today');
    await expect(otherPage).toHaveURL(/\/login/);
    await other.close();

    // The current device stays signed in.
    await page.goto('/today');
    await expect(page).toHaveURL(/\/today/);
  });

  test('export downloads a zip with the five entries', async ({ page }) => {
    await createOnboardedUser(page, { skipPlan: true, prefix: 'exp' });
    const response = await page.request.get('/api/export');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/zip');
    const body = await response.body();
    const names = new Set<string>();
    // Local file headers: signature 0x04034b50 followed by the name length at offset 26.
    let offset = 0;
    while ((offset = body.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), offset)) !== -1) {
      const nameLength = body.readUInt16LE(offset + 26);
      const extraLength = body.readUInt16LE(offset + 28);
      names.add(body.subarray(offset + 30, offset + 30 + nameLength).toString('utf8'));
      offset += 30 + nameLength + extraLength;
    }
    for (const name of ['profile.json', 'plan.json', 'meals.json', 'messages.json'])
      expect(names).toContain(name);
  });

  test('account deletion refuses login afterwards (J14)', async ({ page }) => {
    const username = await createOnboardedUser(page, { skipPlan: true, prefix: 'del' });
    await page.goto('/settings');
    await page.getByTestId('delete-account').click();
    const dialog = page.getByRole('alertdialog');
    await expect(
      dialog.getByRole('button', { name: t('settings.privacy.deleteAction') }),
    ).toBeDisabled();
    await dialog.getByLabel(t('settings.privacy.deleteConfirmLabel')).fill(username);
    await dialog.getByRole('button', { name: t('settings.privacy.deleteAction') }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel(t('auth.login.username')).fill(username);
    await page.getByLabel(t('auth.login.password'), { exact: true }).fill('correct-horse-9');
    await page.getByRole('button', { name: t('auth.login.submit') }).click();
    await expect(page.getByTestId('login-error')).toBeVisible();
  });
});
