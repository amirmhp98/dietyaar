import { test, expect, type Page } from '@playwright/test';
import { DEFAULT_LOCALE, LOCALES } from '../src/lib/locale';

/**
 * Shell smoke test in both projects: <html lang/dir>, no horizontal overflow,
 * the bottom tab bar and the Log meal button visible without scrolling
 * (product spec § 9 acceptance on 390 × 844).
 */
const profile = LOCALES[DEFAULT_LOCALE];
const ROUTES = ['/today', '/settings'] as const;

function readLayout(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const rect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        width: r.width,
        height: r.height,
      };
    };
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      innerHeight: window.innerHeight,
      nav: rect(document.querySelector('[data-testid="bottom-nav"]')),
      logMeal: rect(document.querySelector('[data-testid="log-meal"]')),
    };
  });
}

for (const route of ROUTES) {
  test.describe(`shell on ${route}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
    });

    test('html lang/dir match the profile', async ({ page }) => {
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', profile.lang);
      await expect(html).toHaveAttribute('dir', profile.dir);
    });

    test('nothing overflows horizontally and the primary actions are in view', async ({ page }) => {
      const layout = await readLayout(page);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
      expect(layout.nav).not.toBeNull();
      expect(layout.logMeal).not.toBeNull();
      expect(layout.logMeal!.bottom).toBeLessThanOrEqual(layout.innerHeight);
      expect(layout.logMeal!.width).toBeGreaterThanOrEqual(44);
      expect(layout.logMeal!.height).toBeGreaterThanOrEqual(44);
      expect(layout.nav!.left).toBeGreaterThanOrEqual(-1);
      expect(layout.nav!.right).toBeLessThanOrEqual(layout.clientWidth + 1);
    });
  });
}
