import { expect, test, type Page } from '@playwright/test';
import { formatLocalDate } from '../src/lib/format';
import { t } from '../src/lib/t';
import { localTimeFor } from '../src/lib/time/local-date';
import { APP_TIME_ZONE } from '../src/lib/time/zone';
import { disconnectDb, seedMenuPlan, type SeededPlan } from './helpers/db';
import { backdateAccount, disconnectMealsDb, localDateOf } from './helpers/meals-db';
import { createOnboardedUser } from './helpers/onboard';

/**
 * J6 — backdate (product spec § 7, improvement plan B6): a meal logged from
 * a past day in History carries a "Logging for {date}" context, never
 * borrows the current clock time, and saves with "I don't remember the
 * time"; unticking that leaves the time empty and Save disabled until a time
 * is typed. A future time on today is refused and the draft stays.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 90_000 });

test.afterAll(async () => {
  await disconnectDb();
  await disconnectMealsDb();
});

async function newUserWithPlan(page: Page, prefix: string) {
  const username = await createOnboardedUser(page, { skipPlan: true, prefix });
  const plan: SeededPlan = await seedMenuPlan(username);
  return { username, plan };
}

/** Opens the Today composer and answers the late-night prompt with Today when it shows. */
async function openTodayComposer(page: Page) {
  await page.getByTestId('log-meal').click();
  await expect(page.getByTestId('meal-composer')).toBeVisible();
  const lateNight = page.getByTestId('late-night');
  if (await lateNight.isVisible().catch(() => false)) {
    await lateNight.getByRole('button', { name: t('meal.compose.lateNight.today') }).click();
  }
}

test('J6: History → yesterday → Log meal: the date is shown, the time is asked for, an unknown time saves onto that day', async ({
  page,
}) => {
  const { username, plan } = await newUserWithPlan(page, 'j6');
  // History lists days from the account's first day only (B18): read as a week-old account.
  await backdateAccount(username, 7);
  const yesterday = localDateOf(-1);
  const dinner = plan.slots[4];

  await page.goto('/history');
  const rows = page.getByTestId('history-row');
  await expect(rows.nth(1)).toContainText(t('history.yesterday'));
  await rows.nth(1).click();
  await expect(page).toHaveURL(new RegExp(`/history/${yesterday}$`));

  await page.getByRole('button', { name: t('day.plan.logForDate') }).click();
  const composer = page.getByTestId('meal-composer');
  await expect(composer).toBeVisible();
  // The backdated context is prominent, not inside the accordion.
  await expect(page.getByTestId('logging-for')).toHaveText(
    t('meal.compose.loggingFor', { date: formatLocalDate(yesterday) }),
  );
  await expect(page.getByTestId('date-summary')).toContainText(t('meal.compose.summaryYesterday'));
  await expect(page.getByTestId('date-summary')).toContainText(t('meal.compose.timeUnknownShort'));

  // No invented time: the field is empty, "I don't remember the time" stands in for it.
  await page.getByTestId('more-details').click();
  const composeTime = page.locator('#composer-time');
  await expect(composeTime).toHaveValue('');
  await expect(composeTime).toBeDisabled();
  await expect(page.getByTestId('time-unknown')).toBeChecked();
  await expect(page.getByText(t('meal.compose.confirmTime'))).toBeVisible();

  // Unticking asks for the time and leaves the field empty (B6).
  await page.getByTestId('time-unknown').click();
  await expect(page.getByTestId('time-unknown')).not.toBeChecked();
  await expect(composeTime).toBeEnabled();
  await expect(composeTime).toHaveValue('');
  await expect(page.getByTestId('time-required')).toHaveText(t('meal.review.timeRequired'));

  // "I ate this" on the single-option dinner: the review opens with Save held back.
  await page.getByTestId(`slot-chip-${dinner.id}`).click();
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible();
  const save = page.getByTestId('save-meal');
  await expect(save).toBeDisabled();
  await expect(page.getByTestId('time-required')).toBeVisible();

  // A typed time unlocks Save…
  const reviewTime = page.locator('#review-time');
  await reviewTime.fill('19:30');
  await expect(page.getByTestId('time-required')).toHaveCount(0);
  await expect(save).toBeEnabled();

  // …and so does "I don't remember the time", which clears the field again.
  await page.getByTestId('time-unknown').click();
  await expect(page.getByTestId('time-unknown')).toBeChecked();
  await expect(reviewTime).toHaveValue('');
  await expect(reviewTime).toBeDisabled();
  await expect(page.getByTestId('date-summary')).toContainText(t('meal.compose.timeUnknownShort'));
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText(t('meal.saved')).first()).toBeVisible();
  await expect(composer).toBeHidden();

  // The meal sits on yesterday with no time, linked to its slot; today stays empty.
  await expect(page).toHaveURL(new RegExp(`/history/${yesterday}$`));
  const mealRow = page.getByTestId('meal-row');
  await expect(mealRow).toHaveCount(1);
  await expect(mealRow.first()).toContainText(t('meals.timeUnknown'));
  await expect(mealRow.first()).toContainText(dinner.originalName);
  const dinnerRow = page.getByTestId('plan-slot-row').filter({ hasText: dinner.originalName });
  await expect(dinnerRow.getByTestId('slot-status')).toHaveText(t('slot.match.matched'));

  await page.goto('/today');
  await expect(page.getByTestId('meal-row')).toHaveCount(0);
});

test('a future time on today is refused with the message and the draft stays on screen', async ({
  page,
}) => {
  // The server compares against its own clock; in the last two minutes of the app day there is no later time left.
  test.skip(localTimeFor(new Date(), APP_TIME_ZONE) >= '23:58', 'no future time left today');
  await newUserWithPlan(page, 'fut');
  await page.goto('/today');
  await openTodayComposer(page);

  await page.getByTestId('composer-text').fill('یک سیب');
  await page.getByTestId('more-details').click();
  await page.locator('#composer-time').fill('23:59');
  await page.getByTestId('analyze').click();
  const notice = page.getByTestId('ai-notice');
  if (await notice.isVisible().catch(() => false)) {
    await notice.getByRole('button', { name: t('aiNotice.continue') }).click();
  }
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('#review-time')).toHaveValue('23:59');
  await expect(page.getByTestId('meal-items').getByRole('listitem')).toHaveCount(1);

  await page.getByTestId('save-meal').click();
  await expect(page.getByTestId('save-error')).toHaveText(t('meal.errors.futureTime'));

  // The draft is kept: still the review, items and time as they were, nothing recorded.
  await expect(page.getByTestId('meal-composer')).toBeVisible();
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible();
  await expect(page.getByTestId('meal-items').getByRole('listitem')).toHaveCount(1);
  await expect(page.locator('#review-time')).toHaveValue('23:59');
  await expect(page.getByTestId('save-meal')).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('meal-composer')).toBeHidden();
  await expect(page.getByTestId('meal-row')).toHaveCount(0);
});
