import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InlineName, InlineNames, fillNames, nameText } from '@/components/product/InlineName';
import { NameLabel } from '@/components/product/NameLabel';

const lunch = { originalName: 'ناهار', englishLabel: 'Lunch' };

describe('NameLabel', () => {
  it('renders the name as written, isolated in <bdi>, and never the English label', () => {
    const html = renderToStaticMarkup(<NameLabel originalName="ناهار" englishLabel="Lunch" />);
    expect(html).toContain('<bdi class="font-medium text-base">ناهار</bdi>');
    expect(html).not.toContain('Lunch');
  });

  it('falls back to the English label only when the original name is blank', () => {
    expect(renderToStaticMarkup(<NameLabel originalName="  " englishLabel="Lunch" />)).toContain(
      '<bdi class="font-medium text-base">Lunch</bdi>',
    );
    expect(renderToStaticMarkup(<NameLabel originalName="Oats" englishLabel="oats" />)).toContain(
      '>Oats</bdi>',
    );
  });

  it('sizes and extends the wrapper', () => {
    const html = renderToStaticMarkup(
      <NameLabel originalName="شام" size="lg" className="max-w-full" />,
    );
    expect(html).toContain('class="block max-w-full"');
    expect(html).toContain('text-lg');
  });
});

describe('InlineName', () => {
  it('quotes the original name in a sentence with no label in parentheses', () => {
    const html = renderToStaticMarkup(
      <>{fillNames('Eaten before {slot}.', { slot: <InlineName name={lunch} /> })}</>,
    );
    expect(html).toBe('Eaten before <bdi>ناهار</bdi>.');
    expect(nameText(lunch)).toBe('ناهار');
    expect(nameText({ originalName: '', englishLabel: 'Lunch' })).toBe('Lunch');
  });

  it('joins several names with a direction-neutral dot', () => {
    const html = renderToStaticMarkup(
      <InlineNames names={[lunch, { originalName: 'شام', englishLabel: 'Dinner' }]} />,
    );
    expect(html).toBe('<bdi>ناهار</bdi> · <bdi>شام</bdi>');
  });
});
