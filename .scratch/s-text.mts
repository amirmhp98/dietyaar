export default async function ({ page, shot }) {
  await page.goto('http://localhost:3000/today'); await page.waitForLoadState('networkidle');
  await page.getByTestId('log-meal').click();
  await page.getByTestId('meal-composer').waitFor();
  if (await page.getByTestId('late-night').isVisible()) await page.getByRole('button', { name: 'Today' }).click();
  await page.waitForTimeout(800);
  await shot('compose-with-recent');
  await page.getByTestId('composer-text').fill('۲ تخم‌مرغ و ۸۰ گرم نان سنگک');
  await page.getByTestId('analyze').click();
  await page.getByTestId('ai-notice').waitFor();
  await shot('ai-notice');
  await page.getByTestId('ai-notice').getByRole('button', { name: 'Continue' }).click();
  await page.getByTestId('analyzing').waitFor();
  await shot('analyzing');
  await page.getByTestId('meal-review').waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  await shot('review-text-top');
  console.log('items:', await page.locator('[data-testid^="meal-item-"]').count());
  console.log('slot summary:', await page.getByTestId('slot-summary').textContent());
  await page.locator('[data-testid="composer-body"]').evaluate((el) => el.scrollTo(0, 9999));
  await shot('review-text-bottom');
  console.log('save disabled:', await page.getByTestId('save-meal').isDisabled());
}
