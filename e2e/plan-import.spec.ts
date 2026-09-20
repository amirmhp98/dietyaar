import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/t';
import { createOnboardedUser } from './helpers/onboard';

/**
 * Plan import against the stub AI server (implementation plan 4.4b):
 * J1 first run through Confirm and Ready, and J12 slow / failed imports.
 * The stub answers a five-slot Persian menu plan; `SLOW` delays 20 s and
 * `FAIL` answers 500 (e2e/stub-ai/server.mjs).
 */

const PERSIAN_PLAN =
  'صبحانه: دو عدد تخم‌مرغ، یک کف دست نان سنگک، خیار و گوجه.\nناهار: ۱۵۰ گرم مرغ گریل، ۱۰۰ گرم برنج، سالاد بزرگ.\nماهی دو بار در هفته.';

async function startImport(page: Page, text: string) {
  await page.getByLabel(t('plan.add.label')).fill(text);
  await page.getByRole('button', { name: t('plan.add.continue') }).click();
  // First import: the AI notice, once.
  const notice = page.getByTestId('ai-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(t('aiNotice.plan'));
  await notice.getByRole('button', { name: t('aiNotice.continue') }).click();
  await expect(page.getByRole('heading', { name: t('plan.preparing.title') })).toBeVisible();
}

// Imports run through the single in-process job runner; a SLOW scenario ahead in the queue
// can hold a test for a while, so these specs get a long budget.
test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page }) => {
  await page.context().clearCookies();
});

test('J1: paste a Persian plan, review 8a–8c, confirm, ready, today', async ({ page }) => {
  await createOnboardedUser(page, { prefix: 'imp' });
  await expect(page.getByText(t('onboarding.progress', { current: 6, total: 10 }))).toBeVisible();
  await startImport(page, PERSIAN_PLAN);

  await expect(page.getByRole('heading', { name: t('plan.review.mealsTitle') })).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByText(t('plan.review.slotProgress', { current: 1, total: 5 })),
  ).toBeVisible();
  await expect(page.getByText(t('plan.sourceExcerpt'))).toBeVisible();
  await expect(page.getByText(t('plan.assumed')).first()).toBeVisible();
  // The stub asks one calorie-significant question on the first slot.
  await expect(page.getByText(t('plan.review.question'))).toBeVisible();

  for (let i = 1; i <= 5; i += 1) {
    await expect(
      page.getByText(t('plan.review.slotProgress', { current: i, total: 5 })),
    ).toBeVisible();
    await page.getByRole('button', { name: t('plan.review.looksRight') }).click();
  }

  await expect(page.getByRole('heading', { name: t('plan.review.targetsTitle') })).toBeVisible();
  await expect(page.getByText(t('plan.target.explicit')).first()).toBeVisible();
  await expect(page.getByText(t('plan.target.estimated')).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: t('plan.review.looksRight') }).click();

  // 8c is read-only (decision 023): the stub's two notes, verbatim, nothing to choose.
  await expect(page.getByRole('heading', { name: t('plan.review.notesTitle') })).toBeVisible();
  await expect(page.getByTestId('plan-notes').getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText('ماهی دو بار در هفته')).toBeVisible();
  await expect(page.getByText(t('plan.review.notes.hint'))).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByText(t('plan.review.changeLater'))).toBeVisible();
  // First import: no past meals, so the "N meals affected" line is omitted.
  await expect(page.getByTestId('affected-meals')).toHaveCount(0);
  await page.getByTestId('confirm-plan').click();

  await expect(page.getByRole('heading', { name: t('plan.ready.title') })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('صبحانه', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Breakfast')).toHaveCount(0);
  await expect(page.getByText(t('plan.ready.reflection'))).toBeVisible();
  await page.getByRole('button', { name: t('plan.ready.goToToday') }).click();
  await page.waitForURL(/\/today/);

  await page.goto('/plan');
  await expect(page.getByText('برنامه غذایی')).toBeVisible();
  await expect(page.getByText(t('plan.page.confirmedOn', { date: '' }).trim())).toBeVisible();
});

test('J12: a failed import keeps the text and offers manual setup', async ({ page }) => {
  await createOnboardedUser(page, { prefix: 'fail' });
  const text = `FAIL ${PERSIAN_PLAN}`;
  await startImport(page, text);

  const failed = page.getByTestId('import-failed');
  await expect(failed).toBeVisible({ timeout: 60_000 });
  await expect(failed).toContainText(t('plan.add.failedTitle'));
  await expect(page.getByLabel(t('plan.add.label'))).toHaveValue(text);

  await failed.getByRole('button', { name: t('plan.add.setUpManually') }).click();
  await page.waitForURL(/\/onboarding\/plan\/manual/);
  await expect(page.getByRole('heading', { name: t('plan.manual.structureTitle') })).toBeVisible();
});

test('J12: a slow import lets the user continue to Today and review later', async ({ page }) => {
  await createOnboardedUser(page, { prefix: 'slow' });
  await startImport(page, `SLOW ${PERSIAN_PLAN}`);

  await expect(page.getByText(t('plan.preparing.slow'))).toBeVisible({ timeout: 25_000 });
  await page.getByRole('button', { name: t('plan.preparing.continueToToday') }).click();
  await page.waitForURL(/\/today/);

  await page.goto('/plan');
  const banner = page.getByTestId('import-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(t('import.pending'));
  await expect(banner).toHaveAttribute('data-state', 'READY', { timeout: 90_000 });
  await expect(banner).toContainText(t('import.ready'));
  await banner.getByRole('button', { name: t('import.reviewNow') }).click();
  await page.waitForURL(/\/plan\/review/);
  await expect(page.getByRole('heading', { name: t('plan.review.mealsTitle') })).toBeVisible();
});
