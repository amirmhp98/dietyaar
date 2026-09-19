import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/t';
import { disconnectDb, seedMenuPlan, type SeededPlan } from './helpers/db';
import { createOnboardedUser } from './helpers/onboard';

/**
 * J5 — replaced meal (product spec § 7 option rule as rewritten by B3): a
 * burger sandwich linked to Lunch overlaps none of the lunch options, so no
 * option is owed, Save is enabled, and Today's lunch row reads "A different
 * food was recorded" with no "Option:" line.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 90_000 });

test.afterAll(async () => {
  await disconnectDb();
});

async function newUserWithPlan(page: Page, prefix: string): Promise<SeededPlan> {
  const username = await createOnboardedUser(page, { skipPlan: true, prefix });
  const plan = await seedMenuPlan(username);
  await page.reload();
  return plan;
}

async function openComposer(page: Page) {
  await page.getByTestId('log-meal').click();
  await expect(page.getByTestId('meal-composer')).toBeVisible();
  const lateNight = page.getByTestId('late-night');
  if (await lateNight.isVisible().catch(() => false)) {
    await lateNight.getByRole('button', { name: t('meal.compose.lateNight.today') }).click();
  }
}

test('J5: a burger under Lunch saves without an option and shows as a different food', async ({
  page,
}) => {
  const plan = await newUserWithPlan(page, 'j5');
  const lunch = plan.slots[2];
  await openComposer(page);
  await page.getByTestId('composer-text').fill('ساندویچ همبرگر');
  await page.getByTestId('analyze').click();
  await page
    .getByTestId('ai-notice')
    .getByRole('button', { name: t('aiNotice.continue') })
    .click();
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible({
    timeout: 30_000,
  });

  // Nothing suggested → Extra by default (B4); link it to Lunch by hand.
  await expect(page.getByTestId('slot-summary')).toContainText(t('meal.review.extraMeal'));
  await page.getByTestId('change-link').click();
  await page.getByTestId('slot-select').selectOption(lunch.id);
  await page.getByTestId('change-link').click();

  // No overlap with any lunch option: no option owed, Save enabled.
  await expect(page.getByTestId('option-required')).toHaveCount(0);
  await expect(page.getByTestId('slot-summary')).toContainText('different from your plan');
  await expect(page.getByTestId('save-meal')).toBeEnabled();
  await page.getByTestId('save-meal').click();
  await expect(page.getByText(t('meal.saved')).first()).toBeVisible();
  await expect(page.getByTestId('meal-composer')).toBeHidden();

  const lunchRow = page.getByTestId('plan-slot-row').filter({ hasText: lunch.englishLabel });
  await expect(lunchRow.getByTestId('slot-status')).toHaveText(t('slot.match.different'));
  await expect(lunchRow).not.toContainText(t('slot.option.picked', { label: '' }).trim());
  await expect(page.getByTestId('meal-row')).toHaveCount(1);
});
