import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Pencil, Sun } from 'lucide-react';
import { IconAction } from '@/components/product/IconAction';
import { Illustration } from '@/components/product/Illustration';
import { SectionHeader } from '@/components/product/SectionHeader';
import { Surface } from '@/components/product/Surface';

describe('Surface', () => {
  it('hero is the tinted, elevated, 16 px surface', () => {
    const html = renderToStaticMarkup(<Surface variant="hero">x</Surface>);
    expect(html).toContain('rounded-card');
    expect(html).toContain('bg-tint-2');
    expect(html).toContain('shadow-1');
    expect(html).toContain('p-4');
    expect(html).toContain('data-surface="hero"');
  });

  it('list is a hairline container with divided rows and no padding of its own', () => {
    const html = renderToStaticMarkup(
      <Surface variant="list" as="ul">
        <li>a</li>
      </Surface>,
    );
    expect(html.startsWith('<ul')).toBe(true);
    expect(html).toContain('divide-y');
    expect(html).toContain('border-border');
    expect(html).toContain('rounded-xl');
    expect(html).not.toContain('shadow');
    expect(html).not.toMatch(/\bp-[34]\b/);
  });

  it('note is borderless: muted fill, or the emerald start rule', () => {
    const muted = renderToStaticMarkup(<Surface variant="note">x</Surface>);
    expect(muted).toContain('bg-muted');
    expect(muted).not.toContain('border-border');
    const rule = renderToStaticMarkup(
      <Surface variant="note" rule>
        x
      </Surface>,
    );
    expect(rule).toContain('border-s-[3px]');
    expect(rule).toContain('border-primary');
    expect(rule).not.toContain('bg-muted');
  });
});

describe('SectionHeader', () => {
  it('renders the icon hidden, the title as a heading in the display face, and the trailing slot', () => {
    const html = renderToStaticMarkup(
      <SectionHeader icon={Sun} title="Your plan today" trailing={<button>x</button>} />,
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).toMatch(/<h2[^>]*font-display[^>]*>Your plan today<\/h2>/);
    expect(html).toContain('<button>x</button>');
    expect(renderToStaticMarkup(<SectionHeader icon={Sun} title="History" level={3} />)).toMatch(
      /<h3[^>]*>History<\/h3>/,
    );
  });
});

describe('IconAction', () => {
  it('is a 44 px button named by its label, 36 px when dense', () => {
    const row = renderToStaticMarkup(<IconAction label="Edit plan" icon={Pencil} />);
    expect(row).toContain('aria-label="Edit plan"');
    expect(row).toContain('type="button"');
    expect(row).toContain('size-11');
    const dense = renderToStaticMarkup(
      <IconAction label="Delete" icon={Pencil} size="dense" variant="outline" />,
    );
    expect(dense).toContain('size-9');
    expect(dense).toContain('border-input');
  });
});

describe('Illustration', () => {
  it('draws with currentColor and the primary token only, hidden from assistive tech', () => {
    for (const name of ['noPlan', 'noMeals', 'firstDay', 'ready'] as const) {
      const html = renderToStaticMarkup(<Illustration name={name} />);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('stroke="currentColor"');
      expect(html).toContain('hsl(var(--primary))');
      expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
      expect(html).toContain('width="112"');
    }
  });
});
