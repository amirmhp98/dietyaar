/**
 * Centralized font configuration for the entire application
 * This ensures consistency across all components, charts, and UI elements
 *
 * The font is also defined as a CSS variable: var(--font-family)
 */

export const FONT_FAMILY =
  "'Yekan Bakh', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/**
 * Font family for monospace text (code, technical content)
 * Also available as CSS variable: var(--font-family-mono)
 */
export const FONT_FAMILY_MONO = "'Courier New', 'Monaco', 'Menlo', monospace";

/**
 * Get font family from CSS variable (for dynamic usage)
 */
export const getFontFamily = (): string => {
  if (typeof window === 'undefined') return FONT_FAMILY;
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--font-family').trim() ||
    FONT_FAMILY
  );
};
