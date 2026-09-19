import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/t';
import { createOnboardedUser } from './helpers/onboard';

/**
 * Manual plan setup (implementation plan 4.4a) and My plan (4.5): a
 * targets-only plan confirms with no slot; a same-every-day plan with two
 * slots confirms, shows on My plan, survives Edit → Confirm without the
 * "meals affected" line, and Delete plan with the typed name empties the page.
 */

// Imports run through the single in-process job runner; a SLOW scenario ahead in the queue
// can hold a test for a while, so these specs get a long budget.
test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page }) => {
  await page.context().clearCookies();
});

async function reviewToConfirm(page: Page) {
  // 8a (if any slots) → 8b → 8c → Confirm.
  const targetsHeading = page.getByRole('heading', { name: t('plan.review.targetsTitle') });
  while (!(await targetsHeading.isVisible())) {
    await page.getByRole('button', { name: t('plan.review.looksRight') }).click();
    await page.waitForTimeout(300);
  }
  await expect(page.getByRole('button', { name: t('plan.review.looksRight') })).toBeEnabled({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: t('plan.review.looksRight') }).click();
  await expect(page.getByRole('heading', { name: t('plan.review.notesTitle') })).toBeVisible();
  // No recorded meals are linked to these slots, so the "N meals affected" line is omitted.
  await expect(page.getByText(t('plan.review.changeLater'))).toBeVisible();
  await expect(page.getByTestId('affected-meals')).toHaveCount(0);
  await page.getByTestId('confirm-plan').click();
}

test('targets-only plan confirms with no slot (onboarding)', async ({ page }) => {
  await createOnboardedUser(page, { prefix: 'tgt' });
  await page.getByRole('button', { name: t('plan.add.manual') }).click();
  await page.waitForURL(/\/onboarding\/plan\/manual/);

  await page.getByRole('radio', { name: t('plan.structure.TARGETS_ONLY') }).click();
  await page.getByRole('button', { name: t('plan.manual.continue') }).click();
  await page.getByLabel(t('plan.manual.nameLabel')).fill('Targets plan');
  await page.getByRole('button', { name: t('plan.manual.continue') }).click();

  await expect(page.getByRole('heading', { name: t('plan.manual.targetsTitle') })).toBeVisible();
  await page.getByLabel(`${t('plan.target.low')} (${t('plan.unit.kcal')})`).fill('۱۸۰۰');
  await page.getByLabel(`${t('plan.target.high')} (${t('plan.unit.kcal')})`).fill('2000');
  await page.getByRole('button', { name: t('plan.manual.review') }).click();

  await expect(page.getByRole('heading', { name: t('plan.review.targetsTitle') })).toBeVisible();
  await expect(page.getByText('1,800–2,000 kcal')).toBeVisible();
  await expect(page.getByText(t('plan.target.explicit'))).toBeVisible();
  await page.getByRole('button', { name: t('plan.review.looksRight') }).click();
  await expect(page.getByRole('heading', { name: t('plan.review.notesTitle') })).toBeVisible();
  await expect(page.getByText(t('plan.review.noNotes'))).toBeVisible();
  await page.getByTestId('confirm-plan').click();

  await expect(page.getByRole('heading', { name: t('plan.ready.title') })).toBeVisible();
  await expect(page.getByText(t('plan.page.noSlots'))).toBeVisible();
  await page.getByRole('button', { name: t('plan.ready.goToToday') }).click();
  await page.waitForURL(/\/today/);

  await page.goto('/plan');
  await expect(page.getByText('Targets plan')).toBeVisible();
  await expect(page.getByText('1,800–2,000 kcal')).toBeVisible();
});

test('same-every-day manual plan: My plan, edit, delete', async ({ page }) => {
  await createOnboardedUser(page, { prefix: 'man', skipPlan: true });

  await page.goto('/plan');
  await expect(page.getByTestId('plan-empty')).toBeVisible();
  await page.getByRole('link', { name: t('plan.page.addPlan') }).click();
  await page.waitForURL(/\/plan\/add$/);
  await page.getByRole('button', { name: t('plan.add.manual') }).click();
  await page.waitForURL(/\/plan\/add\/manual/);

  await page.getByRole('radio', { name: t('plan.structure.SAME_EVERY_DAY') }).click();
  await page.getByRole('button', { name: t('plan.manual.continue') }).click();
  await page.getByLabel(t('plan.manual.nameLabel')).fill('Simple plan');
  await page.getByRole('button', { name: t('plan.manual.continue') }).click();

  await expect(page.getByRole('heading', { name: t('plan.manual.slotsTitle') })).toBeVisible();
  await page.getByLabel(t('plan.manual.slotName', { n: 1 })).fill('صبحانه');
  await page.getByRole('button', { name: t('plan.manual.addSlot') }).click();
  await page.getByLabel(t('plan.manual.slotName', { n: 2 })).fill('Lunch');
  await page.getByRole('button', { name: t('plan.manual.continue') }).click();

  // Items for each slot, one screen per slot.
  for (const [slotName, name, label, qty] of [
    ['صبحانه', 'نان سنگک', 'Sangak bread', '80'],
    ['Lunch', 'برنج', 'Rice', '۱۵۰'],
  ]) {
    // Wait for this slot's own screen: the previous one stays mounted while its save is in flight.
    await expect(
      page.getByRole('heading', {
        name: t('plan.manual.itemsTitle', { slot: `\u2068${slotName}\u2069` }),
      }),
    ).toBeVisible();
    await page.getByLabel(t('plan.review.itemName')).fill(name);
    await page.getByLabel(t('plan.review.itemEnglish')).fill(label);
    await page.getByLabel(t('plan.review.quantity')).fill(qty);
    await page.getByRole('button', { name: t('plan.manual.continue') }).click();
  }

  await expect(page.getByRole('heading', { name: t('plan.manual.timesTitle') })).toBeVisible();
  await page.getByRole('button', { name: t('plan.manual.skip') }).click();
  await expect(page.getByRole('heading', { name: t('plan.manual.rangesTitle') })).toBeVisible();
  await page.getByRole('button', { name: t('plan.manual.skip') }).click();
  await expect(page.getByRole('heading', { name: t('plan.manual.targetsTitle') })).toBeVisible();
  await page.getByRole('button', { name: t('plan.manual.skip') }).click();
  await expect(page.getByRole('heading', { name: t('plan.manual.sourceTitle') })).toBeVisible();
  await page.getByLabel(t('plan.manual.sourceLabel')).fill('nutrition specialist');
  await page.getByRole('button', { name: t('plan.manual.review') }).click();

  await page.waitForURL(/\/plan\/review/);
  await expect(page.getByRole('heading', { name: t('plan.review.mealsTitle') })).toBeVisible();
  await reviewToConfirm(page);
  await page.waitForURL(/\/plan$/);

  await expect(page.getByText('Simple plan')).toBeVisible();
  await expect(
    page.getByText(t('plan.page.source', { note: 'nutrition specialist' })),
  ).toBeVisible();
  await expect(page.getByText('Sangak bread')).toBeVisible();
  await expect(page.getByText('Rice')).toBeVisible();
  await expect(page.getByText(/^150( g)?$/)).toBeVisible();

  // Edit → review → confirm: no meals are linked, so the affected line is omitted.
  await page.getByTestId('plan-edit').click();
  await page.waitForURL(/\/plan\/review/);
  await expect(page.getByRole('heading', { name: t('plan.review.mealsTitle') })).toBeVisible();
  await reviewToConfirm(page);
  await page.waitForURL(/\/plan$/);
  await expect(page.getByText('Simple plan')).toBeVisible();

  // Delete plan: the typed confirmation must match the plan name.
  await page.getByTestId('plan-delete').click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  const action = dialog.getByRole('button', { name: t('plan.page.deleteAction') });
  await expect(action).toBeDisabled();
  await dialog.getByLabel(t('plan.page.deleteConfirmLabel')).fill('Simple plan');
  await action.click();
  await expect(page.getByTestId('plan-empty')).toBeVisible();
  await expect(page.getByText(t('plan.page.empty')).first()).toBeVisible();
});
