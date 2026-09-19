import { expect, test } from '@playwright/test';
import { t, tp } from '../src/lib/t';
import { disconnectDb, seedMenuPlan, type SeededPlan } from './helpers/db';
import { disconnectMealsDb, insertMeal, localDateOf } from './helpers/meals-db';
import { createOnboardedUser } from './helpers/onboard';

test.use({ storageState: { cookies: [], origins: [] } });

test.afterAll(async () => {
  await disconnectDb();
  await disconnectMealsDb();
});

const SLOT_ORDER = ['Breakfast', 'First snack', 'Lunch', 'Second snack', 'Dinner'];

test.describe('Today', () => {
  test('no plan → Add your plan; Log meal visible on 390 × 844; then five slot rows, skip, completeness', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const username = await createOnboardedUser(page, { skipPlan: true, prefix: 'tdy' });

    // No plan: logging stays available, the plan block invites a plan.
    await expect(page.getByTestId('no-plan-card')).toContainText(t('day.plan.noPlan'));
    await expect(page.getByRole('link', { name: t('day.plan.addPlan') })).toBeVisible();
    await expect(page.getByTestId('log-meal')).toBeInViewport();
    await expect(page.getByTestId('log-first-meal')).toBeVisible();

    const plan: SeededPlan = await seedMenuPlan(username);
    await page.reload();

    const rows = page.getByTestId('plan-slot-row');
    await expect(rows).toHaveCount(5);
    for (const [index, label] of SLOT_ORDER.entries()) {
      await expect(rows.nth(index)).toContainText(label);
    }
    await expect(rows.nth(0)).toContainText('صبحانه');
    await expect(page.getByTestId('score-band')).toHaveText(t('score.notEnough'));
    await expect(rows.nth(0).getByTestId('log-this-meal')).toBeVisible();
    await expect(rows.nth(2)).toContainText(t('slot.options', { count: 4 }));
    await expect(rows.nth(2)).toContainText('650–720 kcal');

    // Mark the second snack skipped: the row says so; the score is untouched.
    const secondSnack = rows.filter({ hasText: 'Second snack' });
    await secondSnack.getByTestId('mark-skipped').click();
    await expect(secondSnack.getByTestId('slot-status')).toHaveText(t('slot.state.skipped'));
    await expect(page.getByTestId('score-band')).toHaveText(t('score.notEnough'));
    await expect(page.getByTestId('score-coverage')).toHaveCount(0);

    // Completeness persists across a reload.
    const checkbox = page.getByTestId('completeness');
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
    await page.reload();
    await expect(page.getByTestId('completeness')).not.toBeChecked();
    // Nothing scored yet: the hint says what unlocks the number and there is no "Why this score".
    await expect(page.getByTestId('score-hint')).toHaveText(t('score.notEnoughHint'));
    await expect(page.getByTestId('why-this-score')).toHaveCount(0);

    // J5: a sandwich saved under Lunch → "A different food was recorded".
    const today = await localDateOf(username, 0);
    const lunch = plan.slots[2];
    await insertMeal(username, today, {
      time: '13:25',
      planSlotId: lunch.id,
      planOptionId: lunch.options[0].id,
      items: [
        {
          originalName: 'ساندویچ',
          englishLabel: 'sandwich',
          quantity: 1,
          unit: 'piece',
          category: 'BREAD',
          kcal: 520,
        },
      ],
    });
    await page.reload();
    const lunchRow = page.getByTestId('plan-slot-row').filter({ hasText: 'Lunch' });
    await expect(lunchRow.getByTestId('slot-status')).toHaveText(t('slot.match.different'));
    await expect(page.getByTestId('score-band')).toHaveText(t('score.band.different'));
    await expect(page.getByTestId('score-number')).toHaveCount(0);
    await expect(page.getByTestId('meal-row')).toHaveCount(1);
    await expect(page.getByTestId('meal-row').first()).toContainText('sandwich');
    // One scored meal: "Why this score" appears and names the incomplete log.
    await expect(page.getByTestId('why-this-score')).toBeVisible();
    await page.getByTestId('why-this-score').click();
    await expect(page.getByText(t('day.why.basedOnRecorded'))).toBeVisible();

    // J2: breakfast option 1 as prescribed → "Matches your plan"; two scored meals show the number.
    const breakfast = plan.slots[0];
    await insertMeal(username, today, {
      time: '08:30',
      planSlotId: breakfast.id,
      planOptionId: breakfast.options[0].id,
      items: [
        {
          originalName: 'تخم‌مرغ',
          englishLabel: 'egg',
          quantity: 2,
          unit: 'egg',
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
    await page.reload();
    const breakfastRow = page.getByTestId('plan-slot-row').filter({ hasText: 'Breakfast' });
    await expect(breakfastRow.getByTestId('slot-status')).toHaveText(t('slot.match.matched'));
    await expect(page.getByTestId('score-number')).toBeVisible();
    await expect(page.getByTestId('score-coverage')).toContainText(
      tp('score.coverage', 2, { total: 5 }),
    );
    await expect(page.getByTestId('score-coverage')).toContainText(tp('score.skipped', 1));
    // The next unrecorded slot moved on; the completeness choice survived the saves.
    await expect(
      page
        .getByTestId('plan-slot-row')
        .filter({ hasText: 'First snack' })
        .getByTestId('log-this-meal'),
    ).toBeVisible();
    await expect(page.getByTestId('completeness')).not.toBeChecked();
  });
});
