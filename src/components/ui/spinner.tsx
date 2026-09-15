import { Loader2Icon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { t } from '@/lib/t';

// `aria-label` defaults to the localized "Loading"; callers can override it.
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      role="status"
      aria-label={t('ui.loading')}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export { Spinner };
