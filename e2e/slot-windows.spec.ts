import { expect, test } from '@playwright/test';
import { t } from '../src/lib/t';
import { localTimeFor } from '../src/lib/time/local-date';
import { APP_TIME_ZONE } from '../src/lib/time/zone';
import { disconnectDb, seedMenuPlan, setSlotTimes } from './helpers/db';
import { createOnboardedUser } from './helpers/onboard';

test.use({ storageState: { cookies: [], origins: [] } });

test.afterAll(async () => {
  await disconnectDb();
});

/** "HH:mm" in the app zone, `minutes` from the moment the spec started. */
const started = Date.now();
function clockPlus(minutes: number): string {
  return localTimeFor(new Date(started + minutes * 60_000), APP_TIME_ZONE);
}

/**
 * Window states are computed on the server from the real clock (a browser
 * fake clock cannot reach it), so the spec states windows around "now":
 * one that has passed, one that is open, one still to come. Near midnight
 * those three cannot all fit in the day, so the spec stands down.
 */
test.describe('Slot windows on Today', () => {
  test('open, passed and upcoming slots carry the actions their window allows; My plan marks assumed windows', async ({
    page,
  }) => {
    const [hour, minute] = clockPlus(0).split(':').map(Number);
    test.skip(
      (hour === 0 && minute < 35) || (hour === 23 && minute > 15),
      'the three windows need room on both sides of the clock',
    );

    await page.setViewportSize({ width: 390, height: 844 });
    const username = await createOnboardedUser(page, { skipPlan: true, prefix: 'win' });
    const plan = await seedMenuPlan(username);
    const [breakfast, snack1, lunch] = plan.slots;
    await setSlotTimes(breakfast.id, { timeStart: clockPlus(-10), timeEnd: clockPlus(10) });
    await setSlotTimes(snack1.id, { timeStart: clockPlus(-30), timeEnd: clockPlus(-12) });
    await setSlotTimes(lunch.id, { timeStart: clockPlus(20), timeEnd: clockPlus(40) });
    await page.goto('/today');

    const rows = page.getByTestId('plan-slot-row');
    const breakfastRow = rows.filter({ hasText: 'صبحانه' });
    const snackRow = rows.filter({ hasText: 'میان‌وعده اول' });
    const lunchRow = rows.filter({ hasText: 'ناهار' });

    // Open and first in plan order: the highlighted row with the full outline "Log this meal".
    await expect(breakfastRow).toHaveAttribute('data-window-state', 'OPEN');
    await expect(breakfastRow.getByTestId('log-this-meal')).toBeVisible();
    await expect(breakfastRow.getByTestId('mark-skipped')).toBeVisible();
    await expect(breakfastRow.getByTestId('window-passed')).toHaveCount(0);
    await expect(breakfastRow).toContainText(
      t('plan.time.range', { start: clockPlus(-10), end: clockPlus(10) }),
    );

    // Passed: Log and Skip icons plus the muted line.
    await expect(snackRow).toHaveAttribute('data-window-state', 'PASSED');
    await expect(snackRow.getByTestId('log-slot')).toBeVisible();
    await expect(snackRow.getByTestId('mark-skipped')).toBeVisible();
    await expect(snackRow.getByTestId('window-passed')).toHaveText(t('slot.window.passed'));

    // Upcoming: only the faint early Log, no Skip, no instruction text in the subline.
    await expect(lunchRow).toHaveAttribute('data-window-state', 'UPCOMING');
    await expect(lunchRow.getByTestId('log-slot-early')).toHaveAttribute(
      'aria-label',
      t('slot.logEarly', { slot: 'ناهار' }),
    );
    await expect(lunchRow.getByTestId('mark-skipped')).toHaveCount(0);
    await expect(lunchRow.getByTestId('log-slot')).toHaveCount(0);
    await expect(lunchRow).toContainText(t('slot.options', { count: 4 }));
    await expect(lunchRow).not.toContainText('choose what you ate');

    // The floating Log meal button is the only filled primary on the screen.
    await expect(page.getByTestId('log-meal')).toBeInViewport();

    // Logging early opens the composer on that slot.
    await lunchRow.getByTestId('log-slot-early').click();
    await expect(page.getByTestId('meal-composer')).toBeVisible();
    await expect(page.getByTestId(`slot-chip-${lunch.id}`)).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    // My plan: stated windows plain, assumed ones with "≈".
    await page.goto('/plan');
    await expect(
      page.getByText(t('plan.time.range', { start: clockPlus(20), end: clockPlus(40) })),
    ).toBeVisible();
    await expect(
      page.getByText(t('plan.time.assumedRange', { start: '18:30', end: '23:00' })),
    ).toBeVisible();
  });
});
