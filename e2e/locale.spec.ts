import { test, expect, type Page } from '@playwright/test';
import { DEFAULT_LOCALE, LOCALES } from '../src/lib/locale';

/**
 * Locale profile smoke test. Runs in the `chromium` project (stored auth
 * state) and checks that the rendered shell follows the profile selected by
 * NEXT_PUBLIC_LOCALE: <html lang/dir>, computed direction, no horizontal
 * overflow, and the sidebar on the inline-start edge.
 */
const profile = LOCALES[DEFAULT_LOCALE];
const ROUTES = ['/', '/components'] as const;

function readLayout(page: Page) {
  return page.evaluate(() => {
    const edges = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width };
    };
    const root = document.documentElement;
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      // Classic scrollbars take layout space; tolerate that much offset at the edge.
      scrollbarWidth: Math.max(0, window.innerWidth - root.clientWidth),
      aside: edges(document.querySelector('aside')),
      main: edges(document.querySelector('main')),
      panels: Array.from(document.querySelectorAll('aside, [data-slot="sheet-content"]'))
        .map(edges)
        .filter((e): e is NonNullable<typeof e> => e !== null),
    };
  });
}

for (const route of ROUTES) {
  test.describe(`locale profile "${profile.id}" on ${route}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
    });

    test('html lang/dir and computed direction match the profile', async ({ page }) => {
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', profile.lang);
      await expect(html).toHaveAttribute('dir', profile.dir);

      const bodyDirection = await page
        .locator('body')
        .evaluate((el) => getComputedStyle(el).direction);
      expect(bodyDirection).toBe(profile.dir);
    });

    test('nothing overflows horizontally', async ({ page }) => {
      const layout = await readLayout(page);

      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);

      // Every sidebar / sheet panel present in the DOM stays inside the viewport.
      expect(layout.panels.length).toBeGreaterThan(0);
      for (const panel of layout.panels) {
        expect(panel.left).toBeGreaterThanOrEqual(-1);
        expect(panel.right).toBeLessThanOrEqual(layout.clientWidth + layout.scrollbarWidth + 1);
      }
    });

    test('sidebar sits on the inline-start edge', async ({ page }) => {
      await expect(page.locator('aside').first()).toBeVisible();
      const { aside, main, clientWidth, scrollbarWidth } = await readLayout(page);
      if (!aside || !main) throw new Error('Expected <aside> and <main> in the app shell');
      expect(aside.width).toBeGreaterThan(0);

      const tolerance = scrollbarWidth + 1;
      if (profile.dir === 'rtl') {
        // Inline-start is the right edge; the sidebar is to the right of <main>.
        expect(Math.abs(aside.right - clientWidth)).toBeLessThanOrEqual(tolerance);
        expect(aside.left).toBeGreaterThanOrEqual(main.right - 1);
      } else {
        // Inline-start is the left edge; the sidebar is to the left of <main>.
        expect(Math.abs(aside.left)).toBeLessThanOrEqual(tolerance);
        expect(aside.right).toBeLessThanOrEqual(main.left + 1);
      }
    });
  });
}
