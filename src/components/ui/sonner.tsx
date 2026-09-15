'use client';

import { Toaster as Sonner, toast } from 'sonner';

import { useTheme } from '@/lib/theme';
import { useDir } from '@/components/ui/direction';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();
  const dir = useDir();

  return (
    <Sonner
      theme={theme}
      dir={dir}
      position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
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
