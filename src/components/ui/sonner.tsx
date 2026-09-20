'use client';

import { Toaster as Sonner, toast } from 'sonner';

import { useAppearance } from '@/lib/theme';
import { useDir } from '@/components/ui/direction';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { appearance } = useAppearance();
  const dir = useDir();

  return (
    <Sonner
      theme={appearance}
      position="top-center"
      offset={{ top: 'var(--toast-top)' }}
      mobileOffset={{ top: 'var(--toast-top)' }}
      dir={dir}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:rounded-xl group-[.toaster]:shadow-2',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
