'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/UiComponents';
import { t } from '@/lib/t';

/**
 * The one persistent primary action (product spec § 4) and the one filled
 * emerald on the viewport wherever it shows (decision 025): a 56 px pill
 * above the bottom tabs on phones, bottom-end on wider screens.
 */
export function LogMealButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex justify-end px-4 md:bottom-6">
      <div className="mx-auto flex w-full max-w-3xl justify-end">
        <Button
          type="button"
          size="lg"
          className="pointer-events-auto h-14 rounded-full ps-5 pe-6 shadow-2 [&_svg]:size-5"
          onClick={onClick}
          data-testid="log-meal"
        >
          <Plus aria-hidden="true" />
          {t('shell.logMeal')}
        </Button>
      </div>
    </div>
  );
}
