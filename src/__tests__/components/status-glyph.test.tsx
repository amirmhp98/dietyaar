import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BandGlyph,
  StatusGlyph,
  type BandGlyphName,
  type StatusGlyphName,
} from '@/components/product/StatusGlyph';
import { t } from '@/lib/t';

const STATUS_TEXT: Record<StatusGlyphName, string> = {
  NOT_RECORDED: t('glyph.status.notRecorded'),
  RECORDED: t('glyph.status.recorded'),
  PARTLY: t('glyph.status.partly'),
  DIFFERENT: t('glyph.status.different'),
  SKIPPED: t('glyph.status.skipped'),
  NEEDS_REVIEW: t('glyph.status.needsReview'),
  UPCOMING: t('glyph.status.upcoming'),
};

const BAND_TEXT: Record<BandGlyphName, string> = {
  CLOSELY: t('glyph.band.closely'),
  MOSTLY: t('glyph.band.mostly'),
  DIFFERENT: t('glyph.band.different'),
  IN_PROGRESS: t('glyph.band.inProgress'),
};

describe('StatusGlyph', () => {
  it.each(Object.keys(STATUS_TEXT) as StatusGlyphName[])(
    'hides the %s icon from assistive tech and names it in sr-only text',
    (status) => {
      const html = renderToStaticMarkup(<StatusGlyph status={status} />);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain(`<span class="sr-only">${STATUS_TEXT[status]}</span>`);
      expect(html).toContain(`data-testid="glyph-${status}"`);
    },
  );

  it('renders a distinct icon per state', () => {
    const icons = new Set(
      (Object.keys(STATUS_TEXT) as StatusGlyphName[]).map((status) => {
        const html = renderToStaticMarkup(<StatusGlyph status={status} />);
        return html.match(/class="lucide lucide-[a-z-]+/)?.[0];
      }),
    );
    expect(icons.size).toBe(Object.keys(STATUS_TEXT).length);
  });

  it('drops the sr-only name when the row already states the status', () => {
    const html = renderToStaticMarkup(<StatusGlyph status="SKIPPED" describe={false} />);
    expect(html).not.toContain('sr-only');
    expect(html).toContain('aria-hidden="true"');
  });

  it('sizes the icon and takes a class for the wrapper', () => {
    expect(renderToStaticMarkup(<StatusGlyph status="RECORDED" size="lg" />)).toContain('size-6');
    expect(
      renderToStaticMarkup(<StatusGlyph status="RECORDED" className="text-muted-foreground" />),
    ).toContain('text-muted-foreground');
  });
});

describe('BandGlyph', () => {
  it.each(Object.keys(BAND_TEXT) as BandGlyphName[])('names the %s band', (band) => {
    const html = renderToStaticMarkup(<BandGlyph band={band} />);
    expect(html).toContain(`<span class="sr-only">${BAND_TEXT[band]}</span>`);
    expect(html).toContain(`data-testid="glyph-band-${band}"`);
  });
});
