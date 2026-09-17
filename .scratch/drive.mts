// Isolated browser driver for manual verification (not the shared MCP browser).
import { chromium } from '/Users/amirmhp/Desktop/MyMac/Learning/Bozhan VibeCoding Course/Dietyaar/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const [, , script] = process.argv;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  timezoneId: 'Asia/Tehran',
  locale: 'en-US',
  storageState: fs.existsSync('.scratch/state.json') ? '.scratch/state.json' : undefined,
});
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
const shot = async (name: string) => { await page.screenshot({ path: `.scratch/${name}.png` }); console.log('shot', name); };
const mod = await import(`/Users/amirmhp/Desktop/MyMac/Learning/Bozhan VibeCoding Course/Dietyaar/.scratch/${script}.mts`);
try {
  await mod.default({ page, context, shot });
} catch (e) {
  console.log('FAILED:', (e as Error).message);
  await shot('failure');
}
await context.storageState({ path: '.scratch/state.json' });
await browser.close();
