import { expect, test } from '@playwright/test';
import { weekdayName } from '../src/components/product/plan-review/helpers';
import { t } from '../src/lib/t';
import { weekdayOf } from '../src/lib/time/local-date';
import { localDateOf } from './helpers/meals-db';
import { createOnboardedUser } from './helpers/onboard';

/**
 * Weekday plan import (product spec § 6 "Weekday plan", improvement plan
 * B10): a range heading such as "شنبه تا پنجشنبه:" stands for every day of
 * the range, so the plan has slots on all seven days. The stub answers each
 * weekday chunk with three slots (e2e/stub-ai/server.mjs `weekdayChunk`):
 * Saturday's chunk is a training day ("قبل تمرین"), Friday's a rest day
 * ("میان‌وعده عصر"). Review one day, apply the same checks to the rest, then
 * My plan shows weekday tabs with today selected and Today lists today's slots.
 */
test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page }) => {
  await page.context().clearCookies();
});

const SATURDAY = 6;
const WEDNESDAY = 3;
const FRIDAY = 5;
const TRAINING_SNACK = 'قبل تمرین';
const REST_SNACK = 'میان‌وعده عصر';

const WEEKDAY_PLAN = [
  'شنبه تا پنجشنبه:',
  'صبحانه: دو عدد تخم‌مرغ، یک کف دست نان سنگک',
  `${TRAINING_SNACK}: یک عدد موز`,
  'شام: کباب تابه‌ای یا همبرگر خانگی، سیب‌زمینی آب‌پز یا تنوری',
  'جمعه:',
  'صبحانه: دو عدد تخم‌مرغ، یک کف دست نان سنگک',
  `${REST_SNACK}: یک عدد موز`,
  'شام: کباب تابه‌ای یا همبرگر خانگی، سیب‌زمینی آب‌پز یا تنوری',
].join('\n');

test('a Saturday–Thursday range heading fills every day: review one day, apply to the rest, tabs on My plan, today on Today', async ({
  page,
}) => {
  await createOnboardedUser(page, { prefix: 'wk' });
  const today = weekdayOf(localDateOf(0));
  const todaysSnack = today === FRIDAY ? REST_SNACK : TRAINING_SNACK;

  await page.getByLabel(t('plan.add.label')).fill(WEEKDAY_PLAN);
  await page.getByRole('button', { name: t('plan.add.continue') }).click();
  const notice = page.getByTestId('ai-notice');
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: t('aiNotice.continue') }).click();
  await expect(page.getByRole('heading', { name: t('plan.preparing.title') })).toBeVisible();

  // 7a: the first listed day (Saturday) is reviewed in full — three slots.
  await expect(page.getByRole('heading', { name: t('plan.review.mealsTitle') })).toBeVisible({
    timeout: 90_000,
  });
  for (let i = 1; i <= 3; i += 1) {
    await expect(
      page.getByText(t('plan.review.slotProgress', { current: i, total: 3 })),
    ).toBeVisible();
    await page.getByRole('button', { name: t('plan.review.looksRight') }).click();
  }

  // The other six days are listed compactly (the range expanded, B10) and confirmed together.
  await expect(
    page.getByRole('heading', { name: t('plan.review.weekdaySummaryTitle') }),
  ).toBeVisible();
  await expect(
    page.getByText(t('plan.review.weekdaySummaryBody', { day: weekdayName(SATURDAY) })),
  ).toBeVisible();
  for (const weekday of [0, 1, 2, 3, 4, 5]) {
    await expect(page.getByText(weekdayName(weekday), { exact: true })).toBeVisible();
  }
  await expect(page.getByText(weekdayName(SATURDAY), { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: t('plan.review.applyAll') }).click();

  // 7b, 7c: targets once the estimate has run; the two day-type notes; confirm.
  await expect(page.getByRole('heading', { name: t('plan.review.targetsTitle') })).toBeVisible();
  await expect(page.getByRole('button', { name: t('plan.review.looksRight') })).toBeEnabled({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: t('plan.review.looksRight') }).click();
  await expect(page.getByRole('heading', { name: t('plan.review.notesTitle') })).toBeVisible();
  await expect(page.getByTestId('plan-notes').getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText(t('plan.review.notes.reason.DAY_TYPE')).first()).toBeVisible();
  await page.getByTestId('confirm-plan').click();
  await expect(page.getByRole('heading', { name: t('plan.ready.title') })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: t('plan.ready.goToToday') }).click();
  await page.waitForURL(/\/today/);

  // Today lists today's weekday slots, whichever day of the week the suite runs on.
  const rows = page.getByTestId('plan-slot-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('صبحانه');
  await expect(rows.nth(1)).toContainText(todaysSnack);
  await expect(rows.nth(2)).toContainText('شام');

  // My plan: seven weekday tabs from the plan's first day, today's selected.
  await page.goto('/plan');
  await expect(page.getByText('برنامه هفتگی')).toBeVisible();
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(7);
  await expect(tabs.first()).toHaveText(weekdayName(SATURDAY, 'short'));
  await expect(page.getByRole('tab', { selected: true })).toHaveText(weekdayName(today, 'short'));
  await expect(page.getByRole('tabpanel')).toContainText(todaysSnack);

  // A day inside the range carries the range's slots; Friday keeps its own.
  await page.getByRole('tab', { name: weekdayName(WEDNESDAY, 'short') }).click();
  await expect(page.getByRole('tabpanel')).toContainText(TRAINING_SNACK);
  await expect(page.getByRole('tabpanel')).not.toContainText(REST_SNACK);
  await page.getByRole('tab', { name: weekdayName(FRIDAY, 'short') }).click();
  await expect(page.getByRole('tabpanel')).toContainText(REST_SNACK);
  await expect(page.getByRole('tabpanel')).not.toContainText(TRAINING_SNACK);
});
