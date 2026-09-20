import { expect, test, type Page } from '@playwright/test';
import { t, tp } from '../src/lib/t';
import { disconnectDb, seedMenuPlan, type SeededPlan } from './helpers/db';
import { disconnectMealsDb, insertMeal, localDateOf } from './helpers/meals-db';
import { createOnboardedUser } from './helpers/onboard';

/**
 * J10 — replace the plan (product spec § 6 "Editing and replacing"): from
 * My plan, Replace imports a new plan through review; the confirm screen
 * says how many recorded meals are linked to slots that change; after
 * confirming, every day is compared against the new plan (a meal whose slot
 * no longer exists becomes "Extra"). Delete plan leaves the meals and
 * logging in place with "Add your plan" on Today (J13).
 */
test.use({ storageState: { cookies: [], origins: [] } });
// Imports run through the in-process job runner; a SLOW scenario ahead can hold a test for a while.
test.describe.configure({ timeout: 180_000 });

test.afterAll(async () => {
  await disconnectDb();
  await disconnectMealsDb();
});

const PERSIAN_PLAN =
  'صبحانه: دو عدد تخم‌مرغ، یک کف دست نان سنگک، خیار و گوجه.\nناهار: ۱۵۰ گرم مرغ گریل، ۱۰۰ گرم برنج، سالاد بزرگ.\nماهی دو بار در هفته.';
const PLAN_NAME = 'برنامه غذایی';

/** Two meals today, each matched to its slot, so both are linked to slots the replacement drops. */
async function insertTwoLinkedMeals(username: string, plan: SeededPlan) {
  const today = localDateOf(0);
  const breakfast = plan.slots[0];
  const lunch = plan.slots[2];
  await insertMeal(username, today, {
    time: '08:30',
    planSlotId: breakfast.id,
    planOptionId: breakfast.options[0].id,
    items: [
      {
        originalName: 'تخم‌مرغ',
        englishLabel: 'egg',
        quantity: 2,
        unit: 'piece',
        unitGrams: 50,
        category: 'MEAT',
        kcal: 150,
      },
      {
        originalName: 'نان سنگک',
        englishLabel: 'sangak bread',
        quantity: 80,
        unit: 'g',
        category: 'BREAD',
        kcal: 210,
      },
    ],
  });
  await insertMeal(username, today, {
    time: '13:00',
    planSlotId: lunch.id,
    planOptionId: lunch.options[0].id,
    items: [
      {
        originalName: 'برنج',
        englishLabel: 'rice',
        quantity: 150,
        unit: 'g',
        category: 'RICE',
        kcal: 195,
      },
      {
        originalName: 'مرغ',
        englishLabel: 'chicken',
        quantity: 120,
        unit: 'g',
        category: 'MEAT',
        kcal: 200,
      },
    ],
  });
}

async function openTodayComposer(page: Page) {
  await page.getByTestId('log-meal').click();
  await expect(page.getByTestId('meal-composer')).toBeVisible();
  const lateNight = page.getByTestId('late-night');
  if (await lateNight.isVisible().catch(() => false)) {
    await lateNight.getByRole('button', { name: t('meal.compose.lateNight.today') }).click();
  }
}

test('J10: Replace → review → "N meals affected" → confirm re-compares Today; Delete plan keeps logging', async ({
  page,
}) => {
  const username = await createOnboardedUser(page, { skipPlan: true, prefix: 'rpl' });
  const plan = await seedMenuPlan(username);
  await insertTwoLinkedMeals(username, plan);

  await page.goto('/today');
  await expect(page.getByTestId('meal-row')).toHaveCount(2);
  await expect(
    page.getByTestId('plan-slot-row').filter({ hasText: 'صبحانه' }).getByTestId('slot-status'),
  ).toHaveText(t('slot.match.matched'));
  await expect(page.getByTestId('score-number')).toBeVisible();

  // My plan → Replace: the current plan stays until the new one is confirmed.
  await page.goto('/plan');
  await expect(page.getByText(PLAN_NAME)).toBeVisible();
  await page.getByTestId('plan-replace').click();
  await page.waitForURL(/\/plan\/add$/);
  await expect(page.getByText(t('plan.add.replaceHint'))).toBeVisible();
  await page.getByLabel(t('plan.add.label')).fill(PERSIAN_PLAN);
  await page.getByRole('button', { name: t('plan.add.continue') }).click();
  const notice = page.getByTestId('ai-notice');
  if (await notice.isVisible().catch(() => false)) {
    await notice.getByRole('button', { name: t('aiNotice.continue') }).click();
  }
  await expect(page.getByRole('heading', { name: t('plan.preparing.title') })).toBeVisible();
  await page.waitForURL(/\/plan\/review/, { timeout: 90_000 });

  // 7a: the stub's five slots.
  await expect(page.getByRole('heading', { name: t('plan.review.mealsTitle') })).toBeVisible();
  for (let i = 1; i <= 5; i += 1) {
    await expect(
      page.getByText(t('plan.review.slotProgress', { current: i, total: 5 })),
    ).toBeVisible();
    await page.getByRole('button', { name: t('plan.review.looksRight') }).click();
  }
  // 7b: targets, once the baseline estimate has run.
  await expect(page.getByRole('heading', { name: t('plan.review.targetsTitle') })).toBeVisible();
  await expect(page.getByRole('button', { name: t('plan.review.looksRight') })).toBeEnabled({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: t('plan.review.looksRight') }).click();
  // 7c: both recorded meals are linked to slots the replacement drops.
  await expect(page.getByRole('heading', { name: t('plan.review.notesTitle') })).toBeVisible();
  await expect(page.getByTestId('affected-meals')).toHaveText(tp('plan.review.affected', 2));
  await page.getByTestId('confirm-plan').click();
  await page.waitForURL(/\/plan$/);
  await expect(page.getByText(t('plan.review.confirmed')).first()).toBeVisible();
  await expect(page.getByText(PLAN_NAME)).toBeVisible();
  await expect(page.getByTestId('plan-source-text')).toBeVisible();

  // Today is compared against the new plan: the meals stay, now as extras; nothing is recorded per slot.
  await page.goto('/today');
  const rows = page.getByTestId('plan-slot-row');
  await expect(rows).toHaveCount(5);
  for (const row of await rows.all()) {
    await expect(row.getByTestId('slot-status')).toHaveText(t('slot.state.notRecorded'));
  }
  const meals = page.getByTestId('meal-row');
  await expect(meals).toHaveCount(2);
  for (const meal of await meals.all()) await expect(meal).toContainText(t('meals.other'));
  await expect(page.getByTestId('score-band')).toHaveText(t('score.notEnough'));
  await expect(page.getByTestId('score-number')).toHaveCount(0);

  // Delete plan: the typed name confirms; the meals stay and Today invites a plan.
  await page.goto('/plan');
  await page.getByTestId('plan-delete').click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(t('plan.page.deleteConfirmLabel')).fill(PLAN_NAME);
  await dialog.getByRole('button', { name: t('plan.page.deleteAction') }).click();
  await expect(page.getByTestId('plan-empty')).toBeVisible();

  await page.goto('/today');
  await expect(page.getByTestId('no-plan-card')).toContainText(t('day.plan.noPlan'));
  await expect(page.getByRole('link', { name: t('day.plan.addPlan') })).toBeVisible();
  await expect(page.getByTestId('meal-row')).toHaveCount(2);

  // Logging still works without a plan (J13).
  await openTodayComposer(page);
  await page.getByTestId('composer-text').fill('یک سیب');
  await page.getByTestId('analyze').click();
  const mealNotice = page.getByTestId('ai-notice');
  if (await mealNotice.isVisible().catch(() => false)) {
    await mealNotice.getByRole('button', { name: t('aiNotice.continue') }).click();
  }
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('slot-summary')).toContainText(t('meal.review.extraMeal'));
  await page.getByTestId('save-meal').click();
  await expect(page.getByText(t('meal.saved')).first()).toBeVisible();
  await expect(page.getByTestId('meal-composer')).toBeHidden();
  await expect(page.getByTestId('meal-row')).toHaveCount(3);
});
