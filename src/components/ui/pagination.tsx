import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ButtonProps, buttonVariants } from '@/components/ui/button';
import { t } from '@/lib/t';

// Text defaults come from the dictionary; every one is overridable via props.
const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role="navigation"
    aria-label={t('ui.pagination.label')}
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
);
Pagination.displayName = 'Pagination';

const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<'ul'>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn('flex flex-row items-center gap-1', className)} {...props} />
  ),
);
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'>>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn('', className)} {...props} />,
);
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<ButtonProps, 'size'> &
  React.ComponentProps<'a'>;

const PaginationLink = ({ className, isActive, size = 'icon', ...props }: PaginationLinkProps) => (
  <a
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? 'outline' : 'ghost',
        size,
      }),
      className,
    )}
    {...props}
  />
);
PaginationLink.displayName = 'PaginationLink';

const PaginationPrevious = ({
  className,
  label = t('ui.pagination.previous'),
  ...props
}: React.ComponentProps<typeof PaginationLink> & { label?: React.ReactNode }) => (
  <PaginationLink
    aria-label={typeof label === 'string' ? label : undefined}
    size="default"
    className={cn('gap-1 ps-2.5', className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
    <span>{label}</span>
  </PaginationLink>
);
PaginationPrevious.displayName = 'PaginationPrevious';

const PaginationNext = ({
  className,
  label = t('ui.pagination.next'),
  ...props
}: React.ComponentProps<typeof PaginationLink> & { label?: React.ReactNode }) => (
  <PaginationLink
    aria-label={typeof label === 'string' ? label : undefined}
    size="default"
    className={cn('gap-1 pe-2.5', className)}
    {...props}
  >
    <span>{label}</span>
    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
  </PaginationLink>
);
PaginationNext.displayName = 'PaginationNext';

const PaginationEllipsis = ({
  className,
  label = t('ui.pagination.morePages'),
  ...props
}: React.ComponentProps<'span'> & { label?: React.ReactNode }) => (
  <span
    aria-hidden
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">{label}</span>
  </span>
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
