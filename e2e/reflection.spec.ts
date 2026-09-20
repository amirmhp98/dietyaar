import { expect, test } from '@playwright/test';
import { t } from '../src/lib/t';
import { disconnectDb, seedMenuPlan } from './helpers/db';
import { disconnectMealsDb, localDateOf } from './helpers/meals-db';
import { createOnboardedUser } from './helpers/onboard';

test.use({ storageState: { cookies: [], origins: [] } });

test.afterAll(async () => {
  await disconnectDb();
  await disconnectMealsDb();
});

test.describe('Reflection', () => {
  test('first visit shows one paragraph, a refresh returns the same, a changed fact makes it stale, Update replaces it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const username = await createOnboardedUser(page, { skipPlan: true, prefix: 'rfl' });

    const paragraph = page.getByTestId('reflection-paragraph');
    await expect(page.getByRole('heading', { name: t('reflection.title') })).toBeVisible();
    await expect(paragraph).toBeVisible();
    const first = (await paragraph.textContent())?.trim();
    expect(first).toBeTruthy();
    await expect(page.getByTestId('reflection-stale')).toHaveCount(0);

    await page.reload();
    await expect(paragraph).toHaveText(first!);

    // Collapse is remembered for the date.
    await page.getByTestId('reflection-collapse').click();
    await expect(paragraph).toBeHidden();
    await page.reload();
    await expect(page.getByTestId('reflection-card')).toHaveAttribute('data-phase', 'READY');
    await expect(paragraph).toBeHidden();
    await page.getByTestId('reflection-collapse').click();
    await expect(paragraph).toBeVisible();

    // The paragraph used the "today's plan" fact (no plan). A plan appears, and a completeness
    // toggle on yesterday runs the staleness check: the fact changed, so the badge shows.
    await seedMenuPlan(username);
    const yesterday = localDateOf(-1);
    await page.goto(`/history/${yesterday}`);
    await page.getByTestId('completeness').click();
    await expect(page.getByTestId('completeness')).not.toBeChecked();

    await page.goto('/today');
    await expect(page.getByTestId('reflection-stale')).toBeVisible();
    await page.getByTestId('reflection-update').click();
    await expect(page.getByText(t('reflection.updated'))).toBeVisible();
    await expect(page.getByTestId('reflection-stale')).toHaveCount(0);
    await expect(paragraph).toBeVisible();
  });
});
