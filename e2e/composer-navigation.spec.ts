import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/t';
import { disconnectDb, seedMenuPlan } from './helpers/db';
import { createOnboardedUser } from './helpers/onboard';

/**
 * Composer navigation (improvement plan B8): Back keeps the text and returns
 * to the review without a new analysis; Start over discards the draft and
 * the mirror; a reopened sheet says it is continuing.
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

test('Back keeps what was typed; Analyze again returns to the same review; Start over empties the composer', async ({
  page,
}) => {
  const username = await createOnboardedUser(page, { skipPlan: true, prefix: 'nav' });
  await seedMenuPlan(username);
  await page.reload();

  await openComposer(page);
  await analyseText(page, '۲ تخم‌مرغ و ۸۰ گرم نان سنگک');
  await expect(page.getByTestId('meal-items').getByRole('listitem')).toHaveCount(2);

  // Back: the compose step, text intact, no new analysis on the way back.
  await page.getByRole('button', { name: t('meal.review.back') }).click();
  await expect(page.getByTestId('composer-text')).toHaveValue('۲ تخم‌مرغ و ۸۰ گرم نان سنگک');
  await page.getByTestId('analyze').click();
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible();
  await expect(page.getByTestId('analyzing')).toHaveCount(0);
  await expect(page.getByTestId('meal-items').getByRole('listitem')).toHaveCount(2);

  // Close and reopen: the same draft continues, with Start over beside the banner.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('meal-composer')).toBeHidden();
  await openComposer(page);
  await expect(page.getByTestId('resumed-banner')).toContainText(t('meal.compose.resumed'));
  await page.getByTestId('resumed-banner').getByTestId('start-over').click();

  // A fresh compose step: nothing typed, no items, no banner.
  await expect(page.getByTestId('composer-text')).toHaveValue('');
  await expect(page.getByTestId('resumed-banner')).toHaveCount(0);
  await expect(page.getByTestId('meal-review')).toHaveCount(0);

  // The discarded draft does not come back after a reload either.
  await page.reload();
  await openComposer(page);
  await expect(page.getByTestId('composer-text')).toHaveValue('');
  await expect(page.getByTestId('resumed-banner')).toHaveCount(0);
});

test('a restored draft (reload mid-review) says it is continuing and Start over is one tap away', async ({
  page,
}) => {
  const username = await createOnboardedUser(page, { skipPlan: true, prefix: 'res' });
  await seedMenuPlan(username);
  await page.reload();

  await openComposer(page);
  await analyseText(page, 'یک سیب');
  await page.reload();
  await openComposer(page);
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible();
  await expect(page.getByTestId('resumed-banner')).toBeVisible();
  await page.getByTestId('start-over').first().click();
  await expect(page.getByTestId('composer-text')).toHaveValue('');
});
