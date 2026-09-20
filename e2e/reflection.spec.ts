import { expect, test } from '@playwright/test';
import { t } from '../src/lib/t';
import { disconnectDb, seedMenuPlan } from './helpers/db';
import {
  backdateAccount,
  countAiCalls,
  deleteMorningMessages,
  disconnectMealsDb,
  insertMeal,
  localDateOf,
} from './helpers/meals-db';
import { createOnboardedUser } from './helpers/onboard';

test.use({ storageState: { cookies: [], origins: [] } });

test.afterAll(async () => {
  await disconnectDb();
  await disconnectMealsDb();
});

test.describe('Reflection', () => {
  test('first day is static (no AI call); Got it moves the card to the bottom; Read again expands it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const username = await createOnboardedUser(page, { skipPlan: true, prefix: 'rfl' });

    const card = page.getByTestId('reflection-card');
    const paragraph = page.getByTestId('reflection-paragraph');
    await expect(page.getByRole('heading', { name: t('reflection.title') })).toBeVisible();
    await expect(paragraph).toContainText(t('reflection.fallback.firstDay.welcome'));
    await expect(page.getByTestId('reflection-stale')).toHaveCount(0);
    expect(await countAiCalls(username, 'REFLECTION')).toBe(0);

    // The morning moment: the card is the first block, with one action.
    const main = page.getByRole('main');
    await expect(main.locator('section').first()).toHaveAttribute('data-testid', 'reflection-card');
    const first = (await paragraph.textContent())?.trim();
    await page.reload();
    await expect(paragraph).toHaveText(first!);

    // Got it: the card moves below the meals, above the completeness checkbox, collapsed to its title.
    await page.getByTestId('reflection-got-it').click();
    await expect(card).toHaveAttribute('data-acknowledged', 'true');
    await expect(paragraph).toBeHidden();
    await expect(page.getByTestId('reflection-got-it')).toHaveCount(0);
    const cardBox = await card.boundingBox();
    const mealsBox = await page.getByTestId('no-meals').boundingBox();
    const checkboxBox = await page.getByTestId('completeness').boundingBox();
    expect(cardBox!.y).toBeGreaterThan(mealsBox!.y);
    expect(cardBox!.y).toBeLessThan(checkboxBox!.y);

    // Remembered for the date across reloads; Read again expands in place.
    await page.reload();
    await expect(card).toHaveAttribute('data-phase', 'READY');
    await expect(card).toHaveAttribute('data-acknowledged', 'true');
    await expect(paragraph).toBeHidden();
    const toggle = page.getByTestId('reflection-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(paragraph).toBeVisible();
    await toggle.click();
    await expect(paragraph).toBeHidden();
  });

  test('no records yesterday is static; a meal added to yesterday makes it stale and Update calls the AI', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const username = await createOnboardedUser(page, { skipPlan: true, prefix: 'rfl' });
    const paragraph = page.getByTestId('reflection-paragraph');
    await expect(paragraph).toBeVisible();

    // Not the first day any more (a meal two days ago), a plan, nothing logged yesterday.
    const plan = await seedMenuPlan(username);
    await backdateAccount(username, 7);
    const yesterday = await localDateOf(username, -1);
    const twoDaysAgo = await localDateOf(username, -2);
    const lunch = plan.slots[2];
    await insertMeal(username, twoDaysAgo, {
      time: '13:00',
      planSlotId: lunch.id,
      planOptionId: lunch.options[0].id,
      items: [{ originalName: 'برنج', englishLabel: 'rice', quantity: 150, unit: 'g', kcal: 195 }],
    });
    await deleteMorningMessages(username);

    await page.goto('/today');
    await expect(paragraph).toContainText(t('reflection.fallback.noRecords.intro'));
    await expect(page.getByTestId('reflection-stale')).toHaveCount(0);
    expect(await countAiCalls(username, 'REFLECTION')).toBe(0);

    // A meal appears on yesterday; the completeness toggle on that day runs the staleness
    // check: the coverage fact changed, so the paragraph is stale and offers Update.
    await insertMeal(username, yesterday, {
      time: '13:00',
      planSlotId: lunch.id,
      planOptionId: lunch.options[0].id,
      items: [{ originalName: 'برنج', englishLabel: 'rice', quantity: 150, unit: 'g', kcal: 195 }],
    });
    await page.goto(`/history/${yesterday}`);
    await page.getByTestId('completeness').click();
    await expect(page.getByTestId('completeness')).not.toBeChecked();

    await page.goto('/today');
    await expect(page.getByTestId('reflection-stale')).toBeVisible();
    await page.getByTestId('reflection-update').click();
    await expect(page.getByText(t('reflection.updated'))).toBeVisible();
    await expect(page.getByTestId('reflection-stale')).toHaveCount(0);
    await expect(paragraph).toBeVisible();
    await expect(paragraph).not.toContainText(t('reflection.fallback.noRecords.intro'));
    expect(await countAiCalls(username, 'REFLECTION')).toBe(1);
  });
});
