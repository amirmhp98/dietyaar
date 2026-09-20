'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_TABS, isNavItemActive } from '@/lib/navigation';
import { t } from '@/lib/t';
import { cn } from '@/lib/utils';

/**
 * Three primary tabs on phones (product spec § 4, § 12): 44 px targets,
 * safe-area padding, the active tab's icon in a tinted pill so the state is
 * a shape, not only a colour. Wider screens show the tabs in the top bar.
 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label={t('nav.primary')}
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-3xl items-stretch">
        {PRIMARY_TABS.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-2 text-xs font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                    active && 'bg-tint-2',
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
