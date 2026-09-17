export default async function ({ page, shot }) {
  await page.goto('http://localhost:3000/today'); await page.waitForLoadState('networkidle');
  await page.getByTestId('log-meal').click();
  await page.getByTestId('meal-composer').waitFor();
  if (await page.getByTestId('late-night').isVisible()) await page.getByRole('button', { name: 'Today' }).click();
  await page.locator('[data-testid^="slot-chip-"]').nth(2).click();
  await page.locator('[data-testid^="option-"]').nth(0).click();
  await page.getByTestId('meal-review').waitFor();
  await page.waitForTimeout(800);
  await shot('review-planned-top');
  await page.locator('[data-testid="composer-body"]').evaluate((el) => el.scrollTo(0, 700));
  await shot('review-planned-mid');
  await page.locator('[data-testid="composer-body"]').evaluate((el) => el.scrollTo(0, 9999));
  await shot('review-planned-bottom');
  console.log('save disabled:', await page.getByTestId('save-meal').isDisabled());
  // change quantity of the first item to 200 and wait for autosave
  await page.locator('[data-testid="item-quantity"]').first().fill('200');
  await page.waitForTimeout(1500);
  console.log('unsaved visible after autosave:', await page.getByTestId('unsaved').isVisible());
  console.log('item values:', await page.locator('[data-testid="item-values"]').first().textContent());
  await page.getByTestId('save-meal').click();
  await page.getByText('Meal saved').waitFor();
  const id = await page.getByTestId('meal-saved').getAttribute('data-meal-id');
  console.log('saved id', id);
  await page.waitForTimeout(800);
  await shot('after-save');
}
