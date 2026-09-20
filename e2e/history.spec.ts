import { expect, test } from '@playwright/test';
import { t, tp } from '../src/lib/t';
import { disconnectDb, seedMenuPlan, type SeededPlan } from './helpers/db';
import {
  backdateAccount,
  disconnectMealsDb,
  insertMeal,
  localDateOf,
  skipSlots,
} from './helpers/meals-db';
import { createOnboardedUser } from './helpers/onboard';

test.use({ storageState: { cookies: [], origins: [] } });

test.afterAll(async () => {
  await disconnectDb();
  await disconnectMealsDb();
});

/** A different-food lunch plus every other slot skipped: a complete, comparable day. */
async function completeDayWithDifferentLunch(username: string, plan: SeededPlan, date: string) {
  const lunch = plan.slots[2];
  await insertMeal(username, date, {
    time: '13:00',
    planSlotId: lunch.id,
    planOptionId: lunch.options[0].id,
    items: [
      {
        originalName: 'پیتزا',
        englishLabel: 'pizza',
        quantity: 2,
        unit: 'piece',
        category: 'BREAD',
        kcal: 600,
      },
    ],
  });
  await skipSlots(
    username,
    date,
    plan.slots.filter((s) => s.id !== lunch.id).map((s) => s.id),
  );
}

test.describe('History', () => {
  test('seven rows, a complete-by-default yesterday, J9 finishing it, and a pattern sentence', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const username = await createOnboardedUser(page, { skipPlan: true, prefix: 'hst' });
    const plan = await seedMenuPlan(username);
    const yesterday = localDateOf(-1);

    // A brand-new account lists only its first day and says where history starts.
    await page.goto('/history');
    await expect(page.getByTestId('history-row')).toHaveCount(1);
    await expect(page.getByTestId('history-starts')).toBeVisible();

    // The rest of the spec reads as a week-old account.
    await backdateAccount(username, 7);
    const dinner = plan.slots[4];
    await insertMeal(username, yesterday, {
      time: '19:30',
      planSlotId: dinner.id,
      planOptionId: dinner.options[0].id,
      items: [
        {
          originalName: 'برنج',
          englishLabel: 'rice',
          quantity: 100,
          unit: 'g',
          category: 'RICE',
          kcal: 130,
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

    await page.goto('/history');
    await expect(page.getByTestId('history-summary')).toHaveText(t('history.summary.notEnough'));
    const rows = page.getByTestId('history-row');
    await expect(rows).toHaveCount(7);
    await expect(page.getByTestId('history-starts')).toHaveCount(0);
    await expect(rows.nth(0)).toContainText(t('history.today'));
    await expect(rows.nth(0).getByTestId('history-row-state')).toHaveText(
      t('day.state.inProgress'),
    );
    await expect(rows.nth(1).getByTestId('history-row-state')).toHaveText(
      t('day.state.completeByDefault', { recorded: 1, prescribed: 5 }),
    );
    await expect(rows.nth(2).getByTestId('history-row-state')).toHaveText(t('day.state.noMeals'));

    // J9: open yesterday, the helper says what is left, mark the rest skipped.
    await rows.nth(1).click();
    await expect(page).toHaveURL(new RegExp(`/history/${yesterday}$`));
    await expect(
      page.getByText(t('day.completeness.gaps', { recorded: 1, total: 5 })),
    ).toBeVisible();
    await expect(page.getByTestId('log-for-date')).toBeVisible();
    for (let i = 0; i < 4; i += 1) {
      await page.getByTestId('mark-skipped').first().click();
      await expect(page.getByTestId('mark-skipped')).toHaveCount(3 - i);
    }
    await expect(page.getByText(t('day.completeness.gaps', { recorded: 1, total: 5 }))).toHaveCount(
      0,
    );
    await expect(page.getByTestId('score-coverage')).toContainText(tp('score.skipped', 4));

    await page.goto('/history');
    await expect(rows.nth(1).getByTestId('history-row-state')).not.toHaveText(
      t('day.state.completeByDefault', { recorded: 1, prescribed: 5 }),
    );
    await expect(rows.nth(1).getByTestId('history-row-state')).toContainText(
      t('score.band.closely'),
    );

    // Three complete days with a different lunch → the pattern sentence carries denominators.
    for (const offset of [-2, -3, -4]) {
      await completeDayWithDifferentLunch(username, plan, localDateOf(offset));
    }
    await page.reload();
    await expect(page.getByTestId('history-summary')).toContainText('Lunch');
    await expect(page.getByTestId('history-summary')).toContainText(/on 3 of \d complete days/);

    // A future date is not a page (streamed with loading.tsx, so assert the not-found content).
    await page.goto(`/history/${localDateOf(1)}`);
    await expect(page.getByText(t('notFound.title'))).toBeVisible();
  });
});
