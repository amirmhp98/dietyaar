export default async function ({ page }) {
  const username = 'mealui_' + Date.now().toString(36);
  await page.goto('http://localhost:3000/signup');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-9');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.waitForURL('**/onboarding');
  await page.getByLabel('Age in years').fill('30');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'Female' }).click();
  await page.getByLabel('Height (cm)').fill('168');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Weight (kg)').fill('64');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Looks right' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.waitForURL(/\/onboarding\/plan/);
  await page.getByRole('button', { name: "I don't have a plan yet" }).click();
  await page.waitForURL(/\/today/);
  console.log('USERNAME', username);
}
