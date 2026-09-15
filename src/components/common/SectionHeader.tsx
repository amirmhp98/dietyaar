import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SectionHeaderProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  className?: string;
};

export const SectionHeader = ({ icon, title, description, className }: SectionHeaderProps) => (
  <div
    className={cn(
      'text-start flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
      className,
    )}
  >
    <div className="flex items-center gap-3">
      <span className="inline-flex size-9 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <div className="space-y-0.5 text-start">
        <h2 className="text-xl font-bold leading-tight">{title}</h2>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  </div>
);

export default SectionHeader;
