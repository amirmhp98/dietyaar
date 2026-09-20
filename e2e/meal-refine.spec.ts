import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/t';
import { disconnectDb, seedMenuPlan } from './helpers/db';
import { createOnboardedUser } from './helpers/onboard';

/**
 * Refine, not re-analyse (improvement plan B1/B2) against the stub AI
 * server's scenarios: `ASK` returns one PORTION question with the choices
 * "1 slice" / "2 slices" / "3 slices"; a REFINE request echoes the current
 * items with the quantity from the answer and 100 kcal × quantity.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 90_000 });

test.afterAll(async () => {
  await disconnectDb();
});

async function openComposer(page: Page) {
  await page.getByTestId('log-meal').click();
  await expect(page.getByTestId('meal-composer')).toBeVisible();
  const lateNight = page.getByTestId('late-night');
  if (await lateNight.isVisible().catch(() => false)) {
    await lateNight.getByRole('button', { name: t('meal.compose.lateNight.today') }).click();
  }
}

async function analyseText(page: Page, text: string) {
  await page.getByTestId('composer-text').fill(text);
  await page.getByTestId('analyze').click();
  const notice = page.getByTestId('ai-notice');
  if (await notice.isVisible().catch(() => false)) {
    await notice.getByRole('button', { name: t('aiNotice.continue') }).click();
  }
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible({
    timeout: 30_000,
  });
}

test('answering a portion question refines in place: totals change, the answered question goes', async ({
  page,
}) => {
  const username = await createOnboardedUser(page, { skipPlan: true, prefix: 'ask' });
  await seedMenuPlan(username);
  await page.reload();

  await openComposer(page);
  await analyseText(page, 'نان سنگک ASK');
  const questions = page.getByTestId('meal-questions');
  await expect(questions).toBeVisible();
  // The question is the way to answer: the row stays compact rather than opening its editor.
  await expect(page.getByTestId('item-editor')).toHaveCount(0);
  const answer = questions.getByRole('radio', { name: '2 slices' });
  await answer.click();
  await expect(answer).toHaveAttribute('aria-checked', 'true');

  // The refine runs inline: no blocking screen, the review stays on screen.
  await expect(page.getByTestId('analyzing')).toHaveCount(0);
  await expect(page.getByTestId('meal-review')).toBeVisible();
  await expect(page.getByTestId('meal-totals')).toContainText('200', { timeout: 30_000 });
  // The chosen count is the row's amount (B2), and the editor confirms it.
  const first = page.getByTestId('meal-item-1');
  await expect(first).toContainText(t('unit.slice.other', { amount: '2' }));
  await first.getByRole('button', { name: /^Edit / }).click();
  await expect(first.getByTestId('item-quantity')).toHaveValue('2');
  await expect(page.getByTestId('meal-questions')).toHaveCount(0);
  await expect(page.getByTestId('what-changed')).toBeVisible();
  await expect(page.getByTestId('refining')).toHaveCount(0);
});

test('a renamed item survives Re-estimate', async ({ page }) => {
  const username = await createOnboardedUser(page, { skipPlan: true, prefix: 'ren' });
  await seedMenuPlan(username);
  await page.reload();

  await openComposer(page);
  await analyseText(page, '۲ تخم‌مرغ');
  const first = page.getByTestId('meal-item-1');
  await first.getByRole('button', { name: /^Edit / }).click();
  await first.getByTestId('item-name').fill('املت');
  await first.getByRole('button', { name: t('meal.review.doneEditing') }).click();
  await expect(first).toContainText(t('meal.review.needsReestimate'));
  await first.getByRole('button', { name: t('meal.review.reestimate') }).click();

  await expect(page.getByTestId('refining')).toHaveCount(0, { timeout: 30_000 });
  await expect(first).toContainText('املت');
  await expect(first).not.toContainText(t('meal.review.needsReestimate'));
});
