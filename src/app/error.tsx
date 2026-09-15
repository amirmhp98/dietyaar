'use client';

import { Button } from '@/components/UiComponents';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { t } from '@/lib/t';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('error.title')}</h2>
        <p className="text-sm text-muted-foreground max-w-md">{t('error.description')}</p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/50 font-mono">
            {t('error.code', { digest: error.digest })}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="outline">
        <RotateCcw className="h-4 w-4" />
        {t('error.retry')}
      </Button>
    </div>
  );
}
