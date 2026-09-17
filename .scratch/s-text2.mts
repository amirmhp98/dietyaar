export default async function ({ page, shot, context }) {
  await context.addCookies([{ name: 'appearance', value: 'dark', url: 'http://localhost:3000' }]);
  await page.goto('http://localhost:3000/today'); await page.waitForLoadState('networkidle');
  const open = async () => {
    await page.getByTestId('log-meal').click();
    await page.getByTestId('meal-composer').waitFor();
    if (await page.getByTestId('late-night').isVisible()) await page.getByRole('button', { name: 'Today' }).click();
    await page.waitForTimeout(400);
  };
  await open();
  await page.getByTestId('composer-text').fill('a glass of milk FAIL');
  await page.getByTestId('analyze').click();
  await page.waitForTimeout(500);
  console.log('notice shown 2nd time:', await page.getByTestId('ai-notice').isVisible());
  await page.getByTestId('analysis-failed').waitFor({ timeout: 60000 });
  await shot('analysis-failed-dark');
  console.log('text kept:', await page.getByTestId('composer-text').inputValue());
  // close and reload: restore from sessionStorage
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.reload(); await page.waitForLoadState('networkidle');
  await page.getByTestId('log-meal').click();
  await page.getByTestId('meal-composer').waitFor();
  await page.waitForTimeout(800);
  console.log('restored text:', await page.getByTestId('composer-text').inputValue());
  // Other via More details, then Enter manually
  await page.getByTestId('composer-text').fill('a glass of milk');
  await page.getByTestId('more-details').click();
  await page.getByTestId('slot-select').selectOption('OTHER');
  await page.getByTestId('enter-manually').click();
  await page.getByTestId('meal-review').waitFor();
  await page.waitForTimeout(500);
  console.log('slot summary:', await page.getByTestId('slot-summary').textContent());
  await page.getByTestId('add-item').click();
  await page.locator('[data-testid="item-name"]').first().fill('شیر');
  await page.locator('[data-testid="item-quantity"]').first().fill('1');
  await page.waitForTimeout(300);
  await shot('review-manual-item-dark');
  await page.waitForTimeout(1200);
  await page.locator('[data-testid="composer-body"]').evaluate((el) => el.scrollTo(0, 9999));
  await shot('review-manual-bottom-dark');
  await page.getByTestId('save-meal').dblclick();
  await page.getByText('Meal saved').waitFor();
  await page.waitForTimeout(1500);
  console.log('toasts:', await page.getByText('Meal saved').count());
  console.log('saved other id', await page.getByTestId('meal-saved').getAttribute('data-meal-id'));
}
