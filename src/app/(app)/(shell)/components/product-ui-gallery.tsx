'use client';

import { useState } from 'react';
import {
  CalendarDays,
  ClipboardList,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Sun,
  Trash2,
  Utensils,
} from 'lucide-react';
import { Button } from '@/components/UiComponents';
import { IconAction } from '@/components/product/IconAction';
import { NameLabel } from '@/components/product/NameLabel';
import { Illustration, type IllustrationName } from '@/components/product/Illustration';
import { ScoreNumeral } from '@/components/product/ScoreNumeral';
import { SectionHeader } from '@/components/product/SectionHeader';
import {
  BandGlyph,
  StatusGlyph,
  type BandGlyphName,
  type StatusGlyphName,
} from '@/components/product/StatusGlyph';
import { Surface } from '@/components/product/Surface';

const STATUSES: StatusGlyphName[] = [
  'NOT_RECORDED',
  'RECORDED',
  'PARTLY',
  'DIFFERENT',
  'SKIPPED',
  'NEEDS_REVIEW',
  'UPCOMING',
];
const BANDS: BandGlyphName[] = ['CLOSELY', 'MOSTLY', 'DIFFERENT', 'IN_PROGRESS'];
const ILLUSTRATIONS: IllustrationName[] = ['noPlan', 'noMeals', 'firstDay', 'ready'];
const TINTS = [
  { name: 'tint-1', cls: 'bg-tint-1' },
  { name: 'tint-2', cls: 'bg-tint-2' },
  { name: 'tint-3', cls: 'bg-tint-3' },
];

const ROWS: Array<{ status: StatusGlyphName; name: string; line: string }> = [
  { status: 'RECORDED', name: 'صبحانه', line: 'Matches your plan · 08:10' },
  { status: 'PARTLY', name: 'ناهار', line: 'Some of this meal matches your plan' },
  { status: 'NOT_RECORDED', name: 'عصرانه', line: 'Not recorded · opens at 16:00' },
  { status: 'UPCOMING', name: 'شام', line: 'Upcoming · 19:00–21:00' },
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-border/40 pb-2 text-sm font-semibold text-muted-foreground">
      {children}
    </h3>
  );
}

/**
 * Product UI primitives from design.md "Product UI" (decision 025): the three
 * surfaces, section headers, the glyph sets, icon actions, illustrations,
 * the numeral and the tint ladder. Viewed in both themes through the
 * appearance toggle; this block is the visual regression surface for Phase D.
 */
export function ProductUiGallery() {
  const [score, setScore] = useState(62);
  return (
    <section
      className="mb-10 space-y-8 rounded-card border border-border p-4"
      data-testid="product-ui-gallery"
      aria-labelledby="product-ui-title"
    >
      <h2 id="product-ui-title" className="text-lg font-semibold">
        Product UI
      </h2>

      <div className="space-y-3">
        <Label>Surfaces — hero, list, note</Label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0 space-y-6">
            <div className="space-y-3">
              <SectionHeader
                icon={Sun}
                title="Your plan today"
                trailing={<IconAction label="Refresh" icon={RefreshCw} />}
              />
              <Surface variant="hero">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  In progress
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <BandGlyph band="MOSTLY" size="lg" />
                  <ScoreNumeral value={score} data-testid="gallery-score-number" />
                  <span className="text-base font-medium">Mostly followed</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Based on 2 of 5 prescribed meals · 1 skipped
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setScore((s) => (s === 62 ? 78 : 62))}
                >
                  <RefreshCw />
                  Change score
                </Button>
              </Surface>
            </div>
            <div className="space-y-3">
              <SectionHeader icon={Sparkles} title="Yesterday" />
              <Surface variant="note">
                <p className="text-sm leading-relaxed">
                  You recorded four of five meals and stayed close to the plan at lunch. Dinner came
                  a little late, which is fine on a long day.
                </p>
                <Button type="button" variant="ghost" size="sm" className="mt-2 -ms-3">
                  Got it
                </Button>
              </Surface>
              <Surface variant="note" rule>
                <p className="text-sm text-muted-foreground">
                  A note surface with the emerald start rule, for hints beneath a form.
                </p>
              </Surface>
            </div>
          </div>
          <div className="min-w-0 space-y-3">
            <SectionHeader
              icon={Utensils}
              title="Recorded meals"
              trailing={<IconAction label="Log another meal" icon={Plus} variant="outline" />}
            />
            <Surface variant="list" as="ul">
              {ROWS.map((row) => (
                <li key={row.name} className="flex min-h-14 items-center gap-3 px-3 py-2">
                  <StatusGlyph status={row.status} />
                  <div className="min-w-0 flex-1">
                    <NameLabel originalName={row.name} className="truncate" />
                    <p className="truncate text-xs text-muted-foreground">{row.line}</p>
                  </div>
                  <IconAction label={`Edit ${row.name}`} icon={Pencil} />
                  <IconAction label={`More for ${row.name}`} icon={MoreHorizontal} />
                </li>
              ))}
            </Surface>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Section headers — icon + title + trailing action</Label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SectionHeader icon={CalendarDays} title="History" />
          <SectionHeader
            icon={ClipboardList}
            title="My plan"
            trailing={<IconAction label="Edit plan" icon={Pencil} variant="outline" />}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Status glyphs — shape carries the state, never colour alone</Label>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUSES.map((status) => (
            <li key={status} className="flex items-center gap-2 text-sm">
              <StatusGlyph status={status} describe={false} />
              <code className="text-xs text-muted-foreground">{status}</code>
            </li>
          ))}
        </ul>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BANDS.map((band) => (
            <li key={band} className="flex items-center gap-2 text-sm">
              <BandGlyph band={band} describe={false} />
              <code className="text-xs text-muted-foreground">{band}</code>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <Label>Icon actions — row 44 px, dense 36 px</Label>
        <div className="flex flex-wrap items-center gap-3">
          <IconAction label="Edit" icon={Pencil} />
          <IconAction label="Edit" icon={Pencil} variant="outline" />
          <IconAction label="Delete" icon={Trash2} size="dense" />
          <IconAction label="Delete" icon={Trash2} size="dense" variant="outline" />
          <Button type="button">
            <Plus />
            Log
          </Button>
          <Button type="button" variant="outline">
            <Pencil />
            Edit
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Illustrations — two-tone, ink + emerald</Label>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {ILLUSTRATIONS.map((name) => (
            <li key={name} className="flex flex-col items-center gap-2">
              <Illustration name={name} />
              <code className="text-xs text-muted-foreground">{name}</code>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <Label>Typography — display face for headings and the numeral, system stack for body</Label>
        <div className="space-y-2">
          <p className="font-display text-2xl font-semibold">Hello, Sara — display 600</p>
          <p className="text-base">
            Body text stays on the system stack so long paragraphs read like the phone does.
          </p>
          <p className="font-display text-numeral font-bold tabular-nums">78</p>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Tint ladder and elevation</Label>
        <div className="flex flex-wrap gap-4">
          {TINTS.map(({ name, cls }) => (
            <div key={name} className="flex flex-col items-center gap-1.5">
              <div className={`h-14 w-24 rounded-xl border border-border/60 ${cls}`} />
              <code className="text-xs text-muted-foreground">{name}</code>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-14 w-24 rounded-xl bg-card shadow-1" />
            <code className="text-xs text-muted-foreground">shadow-1</code>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-14 w-24 rounded-xl bg-card shadow-2" />
            <code className="text-xs text-muted-foreground">shadow-2</code>
          </div>
        </div>
      </div>
    </section>
  );
}
