export default async function ({ page, shot, context }) {
  const id = process.env.MEAL_ID;
  await page.goto(`http://localhost:3000/meals/${id}`); await page.waitForLoadState('networkidle');
  await shot('details-top');
  await page.evaluate(() => window.scrollTo(0, 9999));
  await shot('details-bottom');
  console.log('link:', await page.getByTestId('meal-link').textContent());
  console.log('match:', await page.getByTestId('meal-match').textContent().catch(() => 'none'));
  console.log('diffs:', await page.getByTestId('meal-differences').textContent().catch(() => 'none'));
  // Edit quantity
  await page.getByTestId('edit-meal').click();
  await page.getByTestId('meal-edit').waitFor();
  await shot('details-edit');
  await page.locator('[data-testid="item-quantity"]').first().fill('120');
  await page.getByTestId('save-meal').click();
  await page.getByText('Meal updated').waitFor();
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('details-after-edit');
  console.log('items after edit:', await page.getByTestId('meal-items').textContent());
  // change link
  await page.getByTestId('change-link').click();
  await page.getByTestId('slot-select').selectOption('OTHER');
  await page.getByTestId('apply-link').click();
  await page.getByText('Plan link updated').waitFor();
  await page.waitForTimeout(1000);
  console.log('link after:', await page.getByTestId('meal-link').textContent());
  // delete
  await page.getByTestId('delete-meal').click();
  await shot('details-delete-dialog');
  await page.getByTestId('confirm-delete').click();
  await page.waitForURL(/\/today/);
  console.log('deleted → today');
}
