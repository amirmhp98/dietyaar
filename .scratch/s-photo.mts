export default async function ({ page, shot }) {
  await page.goto('http://localhost:3000/today'); await page.waitForLoadState('networkidle');
  await page.getByTestId('log-meal').click();
  await page.getByTestId('meal-composer').waitFor();
  if (await page.getByTestId('late-night').isVisible()) await page.getByRole('button', { name: 'Today' }).click();
  await page.waitForTimeout(400);
  await page.getByTestId('photo-input').setInputFiles(process.env.FIXTURE);
  await page.locator('img[alt="Photo 1"]').waitFor({ timeout: 20000 });
  await shot('compose-photo');
  await page.getByTestId('analyze').click();
  await page.getByTestId('ai-notice').waitFor();
  await page.waitForTimeout(600);
  await shot('ai-notice-photo');
  await page.getByTestId('ai-notice').getByRole('button', { name: 'Continue' }).click();
  await page.getByTestId('meal-review').waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);
  await shot('review-photo');
  await page.locator('[data-testid="composer-body"]').evaluate((el) => el.scrollTo(0, 9999));
  await page.getByTestId('save-meal').click();
  await page.getByText('Meal saved').waitFor();
  const id = await page.getByTestId('meal-saved').getAttribute('data-meal-id');
  console.log('photo meal id', id);
  await page.goto(`http://localhost:3000/meals/${id}`); await page.waitForLoadState('networkidle');
  await page.locator('[data-testid="meal-photos"] img').waitFor();
  await page.evaluate(() => window.scrollTo(0, 600));
  await shot('details-photo');
  // reuse as new meal
  await page.getByTestId('reuse-meal').click();
  await page.getByTestId('meal-review').waitFor();
  await page.waitForTimeout(500);
  await shot('reuse-review');
  console.log('reuse items:', await page.locator('[data-testid^="meal-item-"]').count());
}
