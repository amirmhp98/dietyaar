import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { COUNT_UP_MS, ScoreNumeral, countUpValue } from '@/components/product/ScoreNumeral';

describe('ScoreNumeral', () => {
  it('renders the final value with no animation state on the server', () => {
    const html = renderToStaticMarkup(<ScoreNumeral value={78} data-testid="score-number" />);
    expect(html).toContain('>78</span>');
    expect(html).toContain('data-testid="score-number"');
    expect(html).toContain('tabular-nums');
    expect(html).toContain('font-display');
  });

  it('counts from the number on screen to the target with an ease-out, clamped to the ends', () => {
    expect(countUpValue(62, 78, 0)).toBe(62);
    expect(countUpValue(62, 78, 1)).toBe(78);
    expect(countUpValue(62, 78, 2)).toBe(78);
    expect(countUpValue(62, 78, -1)).toBe(62);
    // Ease-out: more than half the distance is covered by the halfway point.
    expect(countUpValue(0, 100, 0.5)).toBeGreaterThan(50);
    // Counting down works the same way.
    expect(countUpValue(78, 62, 0.5)).toBeLessThan(78);
    expect(countUpValue(78, 62, 1)).toBe(62);
  });

  it('keeps the count-up short', () => {
    expect(COUNT_UP_MS).toBeLessThanOrEqual(800);
  });
});
