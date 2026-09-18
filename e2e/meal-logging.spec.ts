import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/t';
import { disconnectDb, seedMenuPlan, type SeededPlan } from './helpers/db';
import { createOnboardedUser } from './helpers/onboard';

/**
 * Meal logging journeys (design-scope J2, J3, J4, J7, J11) through the
 * composer against the stub AI server. Every test creates its own user with a
 * seeded menu plan so runs never collide.
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

/** Opens the composer and answers the late-night prompt with Today when the local clock is 00:00–03:59. */
async function openComposer(page: Page) {
  await page.getByTestId('log-meal').click();
  const composer = page.getByTestId('meal-composer');
  await expect(composer).toBeVisible();
  const lateNight = page.getByTestId('late-night');
  if (await lateNight.isVisible().catch(() => false)) {
    await lateNight.getByRole('button', { name: t('meal.compose.lateNight.today') }).click();
  }
  return composer;
}

async function saveAndWait(page: Page) {
  await page.getByTestId('save-meal').click();
  await expect(page.getByText(t('meal.saved')).first()).toBeVisible();
  await expect(page.getByTestId('meal-composer')).toBeHidden();
}

test('J2: planned meal with options — nothing preselected, option required, saved meal matches', async ({
  page,
}) => {
  const plan = await newUserWithPlan(page, 'j2');
  const lunch = plan.slots[2];
  await openComposer(page);

  await page.getByTestId(`slot-chip-${lunch.id}`).click();
  const options = page.getByTestId('slot-options');
  await expect(options).toBeVisible();
  await expect(options.getByRole('radio', { checked: true })).toHaveCount(0);
  // The review (and its Save button) is not reachable before an option is chosen.
  await expect(page.getByTestId('save-meal')).toHaveCount(0);

  await page.getByTestId(`option-${lunch.id}-1`).click();
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible();
  await expect(page.getByTestId('meal-items').getByRole('listitem')).toHaveCount(3);
  await saveAndWait(page);

  const lunchRow = page.getByTestId('plan-slot-row').nth(2);
  await expect(lunchRow).toContainText(t('slot.match.matched'));
  await expect(page.getByTestId('score-coverage')).toContainText('1 of 5');

  // The last-used option is suggested, not preselected.
  await openComposer(page);
  await page.getByTestId(`slot-chip-${lunch.id}`).click();
  await expect(page.getByTestId('slot-options')).toContainText(t('meal.compose.lastTime'));
  await expect(page.getByTestId('slot-options').getByRole('radio', { checked: true })).toHaveCount(
    0,
  );
});

test('J3: text meal — AI notice once, analysis, restriction reminder, Added chip, saved and listed', async ({
  page,
}) => {
  await newUserWithPlan(page, 'j3');
  await page.goto('/settings');
  await page.getByRole('button', { name: t('settings.edit') }).click();
  await page.getByLabel(t('settings.profile.restrictions')).fill('Walnuts');
  await page.getByRole('button', { name: t('settings.save') }).click();
  await expect(page.getByTestId('profile-summary')).toContainText('Walnuts');
  await page.goto('/today');

  await openComposer(page);
  await page.getByTestId('composer-text').fill('۲ تخم‌مرغ، ۸۰ گرم نان سنگک و یک مشت گردو');
  await page.getByTestId('analyze').click();
  const notice = page.getByTestId('ai-notice');
  await expect(notice).toContainText(t('aiNotice.meal'));
  await notice.getByRole('button', { name: t('aiNotice.continue') }).click();

  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible({
    timeout: 30_000,
  });
  const items = page.getByTestId('meal-items').getByRole('listitem');
  await expect(items).toHaveCount(3);
  await expect(page.getByTestId('restriction-line')).toContainText(
    t('meal.review.restriction', { item: 'Walnuts' }),
  );
  await saveAndWait(page);

  await expect(page.getByTestId('meal-row').first()).toContainText('تخم‌مرغ');
  const breakfastRow = page.getByTestId('plan-slot-row').nth(0);
  await expect(breakfastRow).toContainText(t('slot.match.partly'));

  // Second text meal: no notice this time.
  await openComposer(page);
  await page.getByTestId('composer-text').fill('یک سیب');
  await page.getByTestId('analyze').click();
  await expect(page.getByTestId('ai-notice')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible({
    timeout: 30_000,
  });
});

test('J4: a meal under Other counts in nutrition only', async ({ page }) => {
  await newUserWithPlan(page, 'j4');
  await openComposer(page);
  await page.getByTestId('composer-text').fill('ساندویچ');
  await page.getByTestId('analyze').click();
  await page
    .getByTestId('ai-notice')
    .getByRole('button', { name: t('aiNotice.continue') })
    .click();
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId('change-link').click();
  await page.getByTestId('slot-select').selectOption('OTHER');
  await saveAndWait(page);

  await expect(page.getByTestId('meal-row').first()).toContainText(t('meals.other'));
  for (const row of await page.getByTestId('plan-slot-row').all()) {
    await expect(row).toContainText(t('slot.state.notRecorded'));
  }
});

test('double tap on Save creates one meal; analysis failure keeps the text', async ({ page }) => {
  await newUserWithPlan(page, 'dbl');
  await openComposer(page);
  await page.getByTestId('composer-text').fill('یک کاسه عدسی');
  await page.getByTestId('analyze').click();
  await page
    .getByTestId('ai-notice')
    .getByRole('button', { name: t('aiNotice.continue') })
    .click();
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId('save-meal').dblclick();
  await expect(page.getByText(t('meal.saved')).first()).toBeVisible();
  await expect(page.getByTestId('meal-composer')).toBeHidden();
  await expect(page.getByTestId('meal-row')).toHaveCount(1);

  await openComposer(page);
  await page.getByTestId('composer-text').fill('FAIL این وعده');
  await page.getByTestId('analyze').click();
  await expect(page.getByTestId('analysis-failed')).toContainText(t('meal.errors.analysisFailed'));
  await expect(page.getByTestId('composer-text')).toHaveValue('FAIL این وعده');
  await expect(page.getByTestId('enter-manually')).toBeVisible();
});

test('J11: between 00:00 and 04:00 the composer asks "Was this for yesterday?"', async ({
  page,
}) => {
  await newUserWithPlan(page, 'j11');
  // 00:30 in Asia/Tehran (UTC+3:30) on the real calendar day, so the date is never in the future.
  // The fake clock is set before the navigation so the page starts with it.
  const today = new Date();
  const fixed = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 21, 0, 0),
  );
  await page.clock.setFixedTime(fixed);
  await page.goto('/today');
  await page.getByTestId('log-meal').click();
  const prompt = page.getByTestId('late-night');
  await expect(page.getByTestId('meal-composer')).toContainText(t('meal.compose.lateNight.title'));
  await prompt.getByRole('button', { name: t('meal.compose.lateNight.yesterday') }).click();
  await expect(page.getByTestId('logging-for')).toBeVisible();
});

test('J7: meal details — edit a quantity, then delete with a confirmation naming the meal', async ({
  page,
}) => {
  const plan = await newUserWithPlan(page, 'j7');
  const dinner = plan.slots[4];
  await openComposer(page);
  await page.getByTestId(`slot-chip-${dinner.id}`).click();
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible();
  await saveAndWait(page);

  const mealId = await page.getByTestId('meal-saved').getAttribute('data-meal-id');
  expect(mealId).toBeTruthy();
  await page.goto(`/meals/${mealId}`);
  await expect(page.getByTestId('meal-details')).toBeVisible();
  await expect(page.getByTestId('meal-match')).toContainText(t('slot.match.matched'));

  await page.getByTestId('edit-meal').click();
  const quantity = page.getByTestId('item-quantity').first();
  await quantity.fill('150');
  await page.getByTestId('save-meal').click();
  await expect(page.getByTestId('meal-edit')).toBeHidden();
  await expect(page.getByTestId('meal-items')).toContainText('150');

  await page.getByTestId('delete-meal').click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(t('meal.details.deleteTitle'));
  await dialog.getByTestId('confirm-delete').click();
  await page.waitForURL(/\/today/);
  await expect(page.getByTestId('meal-row')).toHaveCount(0);
});
