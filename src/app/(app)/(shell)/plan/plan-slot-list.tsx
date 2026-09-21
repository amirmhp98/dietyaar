'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/UiComponents';
import { t, tp } from '@/lib/t';
import { cn } from '@/lib/utils';

/** How many slot cards show before "Show all N meals" (decision 025: My plan is not a document). */
const VISIBLE_SLOTS = 2;

/**
 * The slot cards of one day: the first two always, the rest behind one
 * ghost action. Cards are keyed `<li>` elements rendered on the server; this
 * island only owns the fold.
 */
export function PlanSlotList({ cards }: { cards: ReactNode[] }) {
  const [showAll, setShowAll] = useState(false);
  const folded = cards.length > VISIBLE_SLOTS && !showAll;
  return (
    <div className="space-y-3">
      <ul className="space-y-3" data-testid="plan-slots">
        {folded ? cards.slice(0, VISIBLE_SLOTS) : cards}
      </ul>
      {cards.length > VISIBLE_SLOTS ? (
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={!folded}
          data-testid="plan-show-all"
        >
          {folded ? tp('plan.page.showAll', cards.length) : t('plan.page.showFewer')}
          <ChevronDown
            className={cn('transition-transform duration-200', !folded && 'rotate-180')}
            aria-hidden="true"
          />
        </Button>
      ) : null}
    </div>
  );
}
