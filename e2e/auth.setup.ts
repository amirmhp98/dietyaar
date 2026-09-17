import path from 'node:path';
import { test as setup } from '@playwright/test';
import { login } from './helpers/auth';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate as demo', async ({ page }) => {
  // With SKIP_AUTH=true the app serves a mock session and has no login form,
  // so the stored state is simply an empty context (no database needed).
  if (process.env.SKIP_AUTH !== 'true') await login(page);
  await page.context().storageState({ path: authFile });
});
