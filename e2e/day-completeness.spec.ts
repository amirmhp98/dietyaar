import { expect, test, type Page } from '@playwright/test';
import { t, tp } from '../src/lib/t';
import { disconnectDb, seedMenuPlan, type SeededPlan } from './helpers/db';
import { backdateAccount, disconnectMealsDb, insertMeal, localDateOf } from './helpers/meals-db';
import { createOnboardedUser } from './helpers/onboard';

/**
 * J8 / J9 — day completeness (product spec § 8 "Day completeness"): the
 * checkbox is checked by default, an explicit choice persists across visits,
 * an unchecked day limits the score to the recorded meals, and a checked past
 * day with unrecorded slots offers "Mark skipped" until every slot is done.
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

/** Breakfast option 1 as prescribed: one scored ("Matches your plan") meal. */
async function insertMatchedBreakfast(username: string, plan: SeededPlan, date: string) {
  const breakfast = plan.slots[0];
  await insertMeal(username, date, {
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
}

/**
 * Toggles the checkbox and waits for its own server action to answer (the
 * reflection island posts too): the box flips optimistically, so a reload
 * right after the click would abort the request and lose the choice.
 */
async function toggleCompleteness(page: Page, complete: boolean) {
  const answered = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === 'POST' &&
      !!request.headers()['next-action'] &&
      (request.postData() ?? '').includes(`"complete":${complete}`)
    );
  });
  await page.getByTestId('completeness').click();
  await answered;
}

async function openWhyThisScore(page: Page) {
  const why = page.getByTestId('why-this-score');
  await expect(why).toBeVisible();
  if ((await why.getAttribute('data-state')) !== 'open') await why.click();
}

test('J8: unchecking on Today persists across a reload, scopes the score to recorded meals, and re-checking restores', async ({
  page,
}) => {
  const { username, plan } = await newUserWithPlan(page, 'j8');
  await insertMatchedBreakfast(username, plan, localDateOf(0));
  await page.goto('/today');

  const breakfastRow = page.getByTestId('plan-slot-row').filter({ hasText: 'صبحانه' });
  await expect(breakfastRow.getByTestId('slot-status')).toHaveText(t('slot.match.matched'));
  const checkbox = page.getByTestId('completeness');
  await expect(checkbox).toBeChecked();
  await expect(page.getByText(t('day.completeness.helper'))).toBeVisible();

  // Checked (the default): the explanation does not claim a partial log.
  await openWhyThisScore(page);
  await expect(page.getByText(t('day.why.basedOnRecorded'))).toHaveCount(0);

  await toggleCompleteness(page, false);
  await expect(checkbox).not.toBeChecked();
  await page.reload();
  await expect(page.getByTestId('completeness')).not.toBeChecked();
  // Today stays "In progress" either way; the score is scoped to what was recorded.
  await expect(page.getByText(t('score.inProgress'))).toBeVisible();
  await expect(page.getByTestId('score-band')).not.toHaveText(t('score.notEnough'));
  await expect(page.getByTestId('score-coverage')).toContainText(
    tp('score.coverage', 1, { total: 5 }),
  );
  await openWhyThisScore(page);
  await expect(page.getByText(t('day.why.basedOnRecorded'))).toBeVisible();

  // Re-checking is a deliberate choice and persists too.
  await toggleCompleteness(page, true);
  await expect(page.getByTestId('completeness')).toBeChecked();
  await page.reload();
  await expect(page.getByTestId('completeness')).toBeChecked();
  await openWhyThisScore(page);
  await expect(page.getByText(t('day.why.basedOnRecorded'))).toHaveCount(0);
});

test('J9: a checked past day with gaps says what is left; unchecked it is an incomplete log; Mark skipped finishes it', async ({
  page,
}) => {
  const { username, plan } = await newUserWithPlan(page, 'j9');
  await backdateAccount(username, 7);
  const yesterday = localDateOf(-1);
  await insertMatchedBreakfast(username, plan, yesterday);
  await page.goto(`/history/${yesterday}`);

  // Checked by default with 4 unrecorded slots: complete by default, with the helper naming the gap.
  const gaps = page.getByText(t('day.completeness.gaps', { recorded: 1, total: 5 }));
  await expect(gaps).toBeVisible();
  await expect(page.getByTestId('completeness')).toBeChecked();
  await expect(page.getByTestId('score-coverage')).toContainText(t('score.completeByDefault'));
  await expect(page.getByTestId('mark-skipped')).toHaveCount(4);

  // Unchecked: an incomplete log, limited to the recorded meals; the gap helper steps back.
  await toggleCompleteness(page, false);
  await expect(page.getByTestId('completeness')).not.toBeChecked();
  await expect(gaps).toHaveCount(0);
  await expect(page.getByText(t('day.completeness.helper'))).toBeVisible();
  await expect(page.getByTestId('score-coverage')).not.toContainText(t('score.completeByDefault'));
  await openWhyThisScore(page);
  await expect(page.getByText(t('day.why.basedOnRecorded'))).toBeVisible();
  await page.getByTestId('nutrition-details').click();
  await expect(page.getByText(t('nutrition.log.incomplete'))).toBeVisible();

  // The explicit choice survives a visit; History lists the day as an incomplete log.
  await page.goto('/history');
  await expect(page.getByTestId('history-row').nth(1).getByTestId('history-row-state')).toHaveText(
    t('day.state.incomplete'),
  );
  await page.goto(`/history/${yesterday}`);
  await expect(page.getByTestId('completeness')).not.toBeChecked();

  // Re-checked: the gap helper is back, and Mark skipped on each remaining slot removes it.
  await toggleCompleteness(page, true);
  await expect(page.getByTestId('completeness')).toBeChecked();
  await expect(gaps).toBeVisible();
  for (let left = 4; left > 0; left -= 1) {
    await page.getByTestId('mark-skipped').first().click();
    await expect(page.getByTestId('mark-skipped')).toHaveCount(left - 1);
  }
  await expect(gaps).toHaveCount(0);
  await expect(page.getByText(t('day.completeness.helper'))).toBeVisible();
  await expect(page.getByTestId('score-coverage')).toContainText(tp('score.skipped', 4));
  await expect(page.getByTestId('score-coverage')).not.toContainText(t('score.completeByDefault'));
  await page.getByTestId('nutrition-details').click();
  await expect(page.getByText(t('nutrition.log.complete'))).toBeVisible();
});
