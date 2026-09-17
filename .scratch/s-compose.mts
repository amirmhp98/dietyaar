export default async function ({ page, shot }) {
  await page.goto('http://localhost:3000/today'); await page.waitForLoadState('networkidle');
  await page.getByTestId('log-meal').click();
  await page.getByTestId('meal-composer').waitFor();
  const late = page.getByTestId('late-night');
  if (await late.isVisible()) { await shot('late-night'); await page.getByRole('button', { name: 'Today' }).click(); }
  await page.waitForTimeout(1500);
  await shot('compose-light');
  const lunch = page.locator('[data-testid^="slot-chip-"]').nth(2);
  await lunch.click();
  await page.waitForTimeout(500);
  await shot('compose-lunch-options');
  console.log('options:', await page.locator('[role=radio]').count());
  console.log('checked:', await page.locator('[role=radio][aria-checked=true]').count());
  await page.getByTestId('more-details').click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid="composer-body"]').evaluate((el) => el.scrollTo(0, 9999));
  await shot('compose-more-details');
}
