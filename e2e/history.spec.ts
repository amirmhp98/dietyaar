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
    // The summary is one note surface: the sentence, then the counts as their own lines (D3a).
    await expect(page.getByTestId('history-summary')).toHaveText(t('history.summary.notEnough'));
    await expect(page.getByTestId('history-complete-days')).toHaveText(
      tp('history.summary.completeDays', 0),
    );
    await expect(page.getByTestId('history-incomplete-days')).toHaveText(
      tp('history.summary.incompleteDays', 1),
    );
    // The page title lives in the top bar, not as a second heading beneath it (O 2.2-7).
    await expect(page.getByRole('heading', { level: 1, name: t('nav.history') })).toBeVisible();
    await expect(page.getByRole('heading', { name: t('history.title') })).toHaveCount(1);
    const rows = page.getByTestId('history-row');
    await expect(rows).toHaveCount(7);
    await expect(page.getByTestId('history-starts')).toHaveCount(0);
    await expect(rows.nth(0)).toContainText(t('history.today'));
    await expect(rows.nth(0).getByTestId('history-row-state')).toHaveText(
      t('day.state.inProgress'),
    );
    await expect(rows.nth(0).getByTestId('glyph-band-IN_PROGRESS')).toBeVisible();
    await expect(rows.nth(1).getByTestId('history-row-state')).toHaveText(
      t('day.state.completeByDefault', { recorded: 1, prescribed: 5 }),
    );
    await expect(rows.nth(2).getByTestId('history-row-state')).toHaveText(t('day.state.noMeals'));
    await expect(rows.nth(2).getByTestId('glyph-NOT_RECORDED')).toBeVisible();

    // J9: open yesterday, the helper says what is left, mark the rest skipped.
    await rows.nth(1).click();
    await expect(page).toHaveURL(new RegExp(`/history/${yesterday}$`));
    // The day's own header: the date and an outline "Log meal for this date" beside the filled FAB.
    await expect(page.getByTestId('day-date')).toBeVisible();
    await expect(page.getByTestId('log-for-date-header')).toBeVisible();
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
    await expect(rows.nth(1).getByTestId('glyph-band-CLOSELY')).toBeVisible();

    // Three complete days with a different lunch → the pattern sentence names the different
    // food (not "different food or skipped", F 1.2-6) and carries denominators.
    for (const offset of [-2, -3, -4]) {
      await completeDayWithDifferentLunch(username, plan, localDateOf(offset));
    }
    await page.reload();
    await expect(page.getByTestId('history-summary')).toContainText('ناهار');
    await expect(page.getByTestId('history-summary')).toContainText(
      /was a different food on 3 of \d complete days/,
    );
    await expect(page.getByTestId('history-complete-days')).toContainText(/complete days/);

    // A future date is not a page (streamed with loading.tsx, so assert the not-found content).
    await page.goto(`/history/${localDateOf(1)}`);
    await expect(page.getByText(t('notFound.title'))).toBeVisible();
  });
});
