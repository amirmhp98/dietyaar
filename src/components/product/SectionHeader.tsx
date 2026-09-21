import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Product section header (design.md "Product UI" › Section headers): a 20 px
 * icon, the title in the display face, and an optional trailing action. The
 * header is what groups content on a screen — sections sit 24 px apart
 * (`space-y-6`) with 12 px inside (`space-y-3`); no border does the grouping.
 * Distinct from `components/common/SectionHeader`, the admin page header.
 */
export function SectionHeader({
  icon: Icon,
  title,
  trailing,
  level = 2,
  id,
}: {
  icon: LucideIcon;
  title: ReactNode;
  /** An IconAction or a short link, kept to one control. */
  trailing?: ReactNode;
  level?: 2 | 3;
  /** Set when the surrounding section uses `aria-labelledby`. */
  id?: string;
}) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Heading
        id={id}
        className="min-w-0 flex-1 truncate text-start font-display text-base font-semibold leading-tight"
      >
        {title}
      </Heading>
      {trailing !== undefined ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
