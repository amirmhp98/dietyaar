import {
  Circle,
  CircleCheck,
  CircleDot,
  CircleHelp,
  CircleMinus,
  CircleSlash,
  Clock,
  Compass,
  Hourglass,
  Sparkles,
  ThumbsUp,
  type LucideIcon,
} from 'lucide-react';
import type { MatchStatus } from '@/lib/rubric/types';
import { t, type MessageKey } from '@/lib/t';
import { cn } from '@/lib/utils';

/** Slot and meal states as the eye scans them: shape carries the meaning. */
export type StatusGlyphName =
  'NOT_RECORDED' | 'RECORDED' | 'PARTLY' | 'DIFFERENT' | 'SKIPPED' | 'NEEDS_REVIEW' | 'UPCOMING';

/** Score wording bands plus the in-progress state of today. */
export type BandGlyphName = 'CLOSELY' | 'MOSTLY' | 'DIFFERENT' | 'IN_PROGRESS';

/** The glyph of a recorded slot or meal once the matcher has spoken. */
export const MATCH_GLYPH: Record<MatchStatus, StatusGlyphName> = {
  MATCHED: 'RECORDED',
  PARTLY_MATCHED: 'PARTLY',
  DIFFERENT_FOOD: 'DIFFERENT',
};

// Literal keys keep t()'s parameter inference (none of these take params).
const STATUS = {
  NOT_RECORDED: [Circle, 'glyph.status.notRecorded'],
  RECORDED: [CircleCheck, 'glyph.status.recorded'],
  PARTLY: [CircleDot, 'glyph.status.partly'],
  DIFFERENT: [CircleSlash, 'glyph.status.different'],
  SKIPPED: [CircleMinus, 'glyph.status.skipped'],
  NEEDS_REVIEW: [CircleHelp, 'glyph.status.needsReview'],
  UPCOMING: [Clock, 'glyph.status.upcoming'],
} as const satisfies Record<StatusGlyphName, readonly [LucideIcon, MessageKey]>;

const BAND = {
  CLOSELY: [Sparkles, 'glyph.band.closely'],
  MOSTLY: [ThumbsUp, 'glyph.band.mostly'],
  DIFFERENT: [Compass, 'glyph.band.different'],
  IN_PROGRESS: [Hourglass, 'glyph.band.inProgress'],
} as const satisfies Record<BandGlyphName, readonly [LucideIcon, MessageKey]>;

const SIZE = { sm: 'size-4', md: 'size-5', lg: 'size-6' } as const;

type GlyphProps = {
  size?: keyof typeof SIZE;
  /**
   * Whether to render the screen-reader name. Pass `false` when the row
   * already states the status in visible text, so it is not read twice.
   */
  describe?: boolean;
  className?: string;
};

function Glyph({
  icon: Icon,
  label,
  size = 'md',
  describe = true,
  className,
  testId,
}: GlyphProps & { icon: LucideIcon; label: string; testId: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center text-foreground', className)}
      data-testid={testId}
    >
      <Icon className={SIZE[size]} aria-hidden="true" />
      {describe ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

/**
 * Status glyph set (design.md "Product UI" › Status glyphs, decision 025):
 * neutral colour, one shape per state, so status is never colour-only. The
 * glyph is decorative for assistive tech and the name is read through `t()`.
 */
export function StatusGlyph({ status, ...props }: GlyphProps & { status: StatusGlyphName }) {
  const [icon, key] = STATUS[status];
  return <Glyph icon={icon} label={t(key)} testId={`glyph-${status}`} {...props} />;
}

/** Score band glyph for the hero surface and History day rows. */
export function BandGlyph({ band, ...props }: GlyphProps & { band: BandGlyphName }) {
  const [icon, key] = BAND[band];
  return <Glyph icon={icon} label={t(key)} testId={`glyph-band-${band}`} {...props} />;
}
