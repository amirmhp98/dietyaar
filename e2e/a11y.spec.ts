import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/t';
import { disconnectDb, seedMenuPlan } from './helpers/db';
import { disconnectMealsDb, insertMeal, localDateOf } from './helpers/meals-db';
import { createOnboardedUser } from './helpers/onboard';

/**
 * Accessibility gate (tech spec § 15): axe on Today (empty, then scored with
 * the numeral on the hero tint, a recorded row and the nutrition details
 * expanded), the composer, the meal review, Settings and the "Product UI"
 * block of the components gallery (decision 025: the tint surfaces and
 * glyphs), in both themes; zero serious or critical violations.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 120_000 });

test.afterAll(async () => {
  await disconnectDb();
  await disconnectMealsDb();
});

async function expectNoSeriousViolations(page: Page, label: string, within?: string) {
  // Sheets and dialogs fade in; axe must see the settled colours.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getTiming().iterations ?? 1))
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  const builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'best-practice',
  ]);
  const results = await (within ? builder.include(within) : builder).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious,
    `${label}: ${serious
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
      .join('\n')}`,
  ).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  test(`Today, composer, review and Settings pass axe in the ${theme} theme`, async ({
    page,
    context,
  }) => {
    const username = await createOnboardedUser(page, { skipPlan: true, prefix: `a11y${theme}` });
    const plan = await seedMenuPlan(username);
    await context.addCookies([{ name: 'appearance', value: theme, url: page.url() }]);
    await page.goto('/today');
    await expect(page.locator('html')).toHaveAttribute('data-appearance', theme);
    await expect(page.getByTestId('reflection-card')).toHaveAttribute('data-phase', 'READY');
    await expectNoSeriousViolations(page, `today/${theme}`);

    // Scored: the numeral and coverage on the hero tint, a recorded row's chips, the nutrition bars.
    const today = localDateOf(0);
    for (const [slot, time, name, kcal] of [
      [plan.slots[0], '08:30', 'تخم‌مرغ', 150],
      [plan.slots[2], '13:00', 'ساندویچ', 520],
    ] as const) {
      await insertMeal(username, today, {
        time,
        planSlotId: slot.id,
        planOptionId: slot.options[0].id,
        items: [{ originalName: name, englishLabel: name, quantity: 1, unit: 'piece', kcal }],
      });
    }
    await page.reload();
    await expect(page.getByTestId('score-number')).toBeVisible();
    await page.getByTestId('why-this-score').click();
    await page.getByTestId('slot-details').first().click();
    await page.getByTestId('nutrition-details').click();
    await page.locator('[data-nutrient="ENERGY_KCAL"] button').click();
    await expectNoSeriousViolations(page, `today-scored/${theme}`);

    await page.getByTestId('log-meal').click();
    const composer = page.getByTestId('meal-composer');
    await expect(composer).toBeVisible();
    const lateNight = page.getByTestId('late-night');
    if (await lateNight.isVisible().catch(() => false)) {
      await lateNight.getByRole('button', { name: t('meal.compose.lateNight.today') }).click();
    }
    // With the lunch options open, so the option list surface is checked too (D2a).
    await page.getByTestId(`slot-chip-${plan.slots[2].id}`).click();
    await expect(page.getByTestId('slot-options')).toBeVisible();
    await expectNoSeriousViolations(page, `composer/${theme}`);

    const dinner = plan.slots[4];
    await page.getByTestId(`slot-chip-${dinner.id}`).click();
    await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible();
    await expectNoSeriousViolations(page, `review/${theme}`);
    // The expanded item editor and the open details (D2b, D2c).
    await page
      .getByTestId('meal-item-1')
      .getByRole('button', { name: /^Edit / })
      .click();
    await page.getByTestId('review-more-details').click();
    await expectNoSeriousViolations(page, `review-expanded/${theme}`);
    await page.keyboard.press('Escape');

    await page.goto('/settings');
    await expect(page.getByTestId('profile-summary')).toBeVisible();
    await expectNoSeriousViolations(page, `settings/${theme}`);

    // The Product UI primitives (decision 025) before the screens adopt them:
    // tint surfaces, glyphs and icon actions must pass in both themes.
    await page.goto('/components');
    await expect(page.getByTestId('product-ui-gallery')).toBeVisible();
    await expectNoSeriousViolations(
      page,
      `product-ui/${theme}`,
      '[data-testid="product-ui-gallery"]',
    );
  });
}
