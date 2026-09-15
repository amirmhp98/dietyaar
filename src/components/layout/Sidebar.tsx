'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/UiComponents';
import { logoutAction } from '@/actions/auth.actions';
import { APP_NAME } from '@/lib/app-config';
import { t } from '@/lib/t';
import { isNavItemActive, visibleNavGroups, type NavGroup, type NavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from './AuthProvider';
import { Logo } from './Logo';
import { useSidebar } from './SidebarContext';

function NavItemContent({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  return (
    <div
      className={cn(
        'group flex items-center rounded-lg px-3 font-medium transition-all duration-200',
        collapsed ? 'justify-center' : 'gap-3',
        item.secondary ? 'py-1.5 text-xs' : 'py-2.5 text-sm',
        item.secondary
          ? isActive
            ? 'bg-muted/40 text-muted-foreground'
            : 'text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground/70'
          : isActive
            ? 'bg-primary/10 text-primary shadow-sm'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      )}
    >
      <item.icon
        className={cn(
          'shrink-0 transition-colors',
          item.secondary ? 'h-3.5 w-3.5 text-muted-foreground/50' : 'h-4.5 w-4.5',
          !item.secondary &&
            (isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'),
        )}
      />
      {!collapsed && (
        <>
          <span>{item.label}</span>
          {isActive && !item.secondary && (
            <div className="ms-auto h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          )}
        </>
      )}
    </div>
  );
}

/** Wraps children in a tooltip when the sidebar is collapsed (labels are hidden). */
function CollapsedTooltip({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  if (!collapsed) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="end" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const user = useAuth();
  const groups = visibleNavGroups(user);

  const primaryGroups = groups.filter((g) => !g.secondary && !g.adminOnly);
  const secondaryGroups = groups.filter((g) => g.secondary);
  const adminGroups = groups.filter((g) => g.adminOnly);

  const renderGroup = (group: NavGroup) => (
    <div key={group.title} className={group.secondary ? 'space-y-1' : 'space-y-1.5'}>
      {!collapsed && (
        <h3
          className={cn(
            'px-2 text-xs font-semibold',
            group.secondary ? 'text-muted-foreground/40' : 'text-muted-foreground/70',
          )}
        >
          {group.title}
        </h3>
      )}
      {group.items.map((item) => {
        const isActive = isNavItemActive(item.href, pathname);
        return (
          <CollapsedTooltip key={item.href} label={item.label} collapsed={collapsed}>
            <Link href={item.href} onClick={onNavigate} className="block">
              <NavItemContent item={item} isActive={isActive} collapsed={collapsed} />
            </Link>
          </CollapsedTooltip>
        );
      })}
    </div>
  );

  return (
    <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
      <div className="space-y-5">{primaryGroups.map(renderGroup)}</div>
      {secondaryGroups.length > 0 && (
        <div className="mt-auto space-y-3 border-t border-border/30 pt-4">
          {secondaryGroups.map(renderGroup)}
        </div>
      )}
      {adminGroups.length > 0 && (
        <div className="space-y-3 border-t border-border/30 pt-4">
          {adminGroups.map(renderGroup)}
        </div>
      )}
      <div className="mt-3 border-t border-border/30 pt-3">
        <CollapsedTooltip label={t('auth.logout')} collapsed={collapsed}>
          <form action={logoutAction}>
            <button
              type="submit"
              className={cn(
                'flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/50 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive',
                collapsed ? 'justify-center' : 'gap-3',
              )}
            >
              <LogOut className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span>{t('auth.logout')}</span>}
            </button>
          </form>
        </CollapsedTooltip>
      </div>
    </nav>
  );
}

export function Sidebar() {
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      {/* Desktop / tablet */}
      <aside
        className={cn(
          'sticky top-0 z-50 hidden h-screen shrink-0 flex-col overflow-hidden border-e border-border bg-card/60 backdrop-blur-xl transition-[width] duration-300 ease-in-out md:flex',
          isCollapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-border px-5">
          <Link href="/">
            <Logo compact={isCollapsed} />
          </Link>
        </div>

        <SidebarNav collapsed={isCollapsed} />

        {!isCollapsed && (
          <div className="border-t border-border/60 px-4 py-3">
            <p className="text-center text-2xs text-muted-foreground/50">{APP_NAME}</p>
          </div>
        )}
      </aside>

      {/* Mobile drawer */}
      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="start" className="flex w-60 flex-col p-0">
          <SheetTitle className="sr-only">{t('nav.menuTitle')}</SheetTitle>
          <div className="flex h-14 shrink-0 items-center justify-center border-b border-border px-5">
            <Link href="/" onClick={() => setMobileOpen(false)}>
              <Logo />
            </Link>
          </div>
          <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          <div className="border-t border-border/60 px-4 py-3">
            <p className="text-center text-2xs text-muted-foreground/50">{APP_NAME}</p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
