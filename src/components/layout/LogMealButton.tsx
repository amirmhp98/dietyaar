'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/UiComponents';
import { t } from '@/lib/t';

/**
 * The one persistent primary action (product spec § 4). Fixed above the
 * bottom nav on mobile; the composer itself is mounted by the shell island.
 */
export function LogMealButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex justify-end px-4 md:bottom-6">
      <div className="mx-auto flex w-full max-w-3xl justify-end">
        <Button
          type="button"
          size="lg"
          className="pointer-events-auto h-12 rounded-full px-5 shadow-lg"
          onClick={onClick}
          data-testid="log-meal"
        >
          <Plus className="size-5" />
          {t('shell.logMeal')}
        </Button>
      </div>
    </div>
  );
}
