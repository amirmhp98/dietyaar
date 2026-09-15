'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

// Context to pass variant to triggers
const TabsContext = React.createContext<'underline' | 'pills' | 'solid'>('underline');

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-6', className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  variant = 'underline',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  variant?: 'underline' | 'pills' | 'solid';
}) {
  const variants = {
    // Underline: Clean with animated bottom border
    underline: 'bg-transparent border-b border-border/60 gap-0',
    // Pills: Separated rounded buttons (similar to shadcn example)
    pills: 'bg-transparent gap-2',
    // Solid: Buttons in a container (improved classic)
    solid: 'bg-muted/50 rounded-xl p-1 gap-1',
  };

  return (
    <TabsContext.Provider value={variant}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(
          'inline-flex w-fit items-center justify-center',
          variants[variant],
          className,
        )}
        {...props}
      />
    </TabsContext.Provider>
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = React.useContext(TabsContext);

  const variantClasses = {
    underline: cn(
      'border-b-2 border-transparent rounded-none -mb-px',
      'text-muted-foreground hover:text-foreground hover:border-border',
      'data-[state=active]:text-primary data-[state=active]:border-primary',
      'data-[state=active]:font-semibold',
    ),
    pills: cn(
      'rounded-lg border border-transparent',
      'text-muted-foreground hover:text-foreground',
      'hover:bg-muted/50 hover:border-border/50',
      'data-[state=active]:bg-primary/10 dark:data-[state=active]:bg-primary/20',
      'data-[state=active]:text-primary data-[state=active]:border-primary/30',
      'data-[state=active]:font-semibold data-[state=active]:shadow-sm',
    ),
    solid: cn(
      'rounded-lg',
      'text-muted-foreground hover:text-foreground',
      'data-[state=active]:bg-background data-[state=active]:text-foreground',
      'data-[state=active]:shadow-md data-[state=active]:font-semibold',
    ),
  };

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // Base styles
        'relative inline-flex items-center justify-center gap-2',
        'px-4 py-2.5 text-sm font-medium whitespace-nowrap',
        'transition-all duration-300 ease-out',
        'disabled:pointer-events-none disabled:opacity-50',

        // Focus styles
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg',

        // Icon styles
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",

        // Apply variant-specific styles
        variantClasses[variant],

        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        'flex-1 outline-none',
        'data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1',
        'data-[state=active]:duration-300',
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
