import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/t';
import { disconnectDb, seedMenuPlan } from './helpers/db';
import { createOnboardedUser } from './helpers/onboard';

/**
 * Accessibility gate (tech spec § 15): axe on Today, the composer, the meal
 * review and Settings, in both themes; zero serious or critical violations.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 120_000 });

test.afterAll(async () => {
  await disconnectDb();
});

async function expectNoSeriousViolations(page: Page, label: string) {
  // Sheets and dialogs fade in; axe must see the settled colours.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getTiming().iterations ?? 1))
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
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
    await expectNoSeriousViolations(page, `today/${theme}`);

    await page.getByTestId('log-meal').click();
    const composer = page.getByTestId('meal-composer');
    await expect(composer).toBeVisible();
    const lateNight = page.getByTestId('late-night');
    if (await lateNight.isVisible().catch(() => false)) {
      await lateNight.getByRole('button', { name: t('meal.compose.lateNight.today') }).click();
    }
    await expectNoSeriousViolations(page, `composer/${theme}`);

    const dinner = plan.slots[4];
    await page.getByTestId(`slot-chip-${dinner.id}`).click();
    await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible();
    await expectNoSeriousViolations(page, `review/${theme}`);
    await page.keyboard.press('Escape');

    await page.goto('/settings');
    await expect(page.getByTestId('profile-summary')).toBeVisible();
    await expectNoSeriousViolations(page, `settings/${theme}`);
  });
}
