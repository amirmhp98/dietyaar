'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CircleAlert } from 'lucide-react';
import { discardPlanDraftAction, retryPlanImportAction } from '@/actions/plan.actions';
import {
  ImportStatusBanner,
  type ImportBannerState,
} from '@/components/product/ImportStatusBanner';
import { Surface } from '@/components/product/Surface';
import { Button, toast } from '@/components/UiComponents';
import { t } from '@/lib/t';
import { useImportPolling } from '@/app/(app)/onboarding/plan/add-plan-flow';

/**
 * My plan's draft state (design-scope screen 6 "draft pending"): the import
 * banner for imports; a note surface with Continue / Discard for an
 * unfinished manual set-up or unconfirmed edit. Both actions stay outline
 * or ghost: the floating Log meal button is the page's filled primary.
 */
export function PlanDraftBanner({
  kind,
  state,
  continueHref,
}: {
  kind: 'IMPORT' | 'MANUAL' | 'EDIT';
  state: ImportBannerState;
  /** Where an unfinished manual/edit draft resumes. */
  continueHref: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(state);
  const [pending, startTransition] = useTransition();

  useImportPolling(kind === 'IMPORT' && current === 'PENDING', {
    onReady: () => {
      setCurrent('READY');
      router.refresh();
    },
    onFailed: (next) => {
      setCurrent('FAILED');
      if (next === 'NONE') router.refresh();
    },
  });

  if (kind === 'IMPORT') {
    return (
      <ImportStatusBanner
        state={current}
        onReview={() => router.push('/plan/review')}
        onRetry={() =>
          startTransition(async () => {
            const result = await retryPlanImportAction();
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setCurrent('PENDING');
          })
        }
        onManual={() => router.push('/plan/add/manual')}
      />
    );
  }

  return (
    <Surface variant="note" role="status" className="space-y-3 text-sm">
      <p className="flex items-start gap-2">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          {kind === 'MANUAL'
            ? t('plan.page.draft.unfinishedManual')
            : t('plan.page.draft.unfinishedEdit')}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(continueHref)}>
          {t('plan.page.draft.continue')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await discardPlanDraftAction();
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success(t('plan.page.draft.discarded'));
              router.refresh();
            })
          }
        >
          {t('plan.page.draft.discard')}
        </Button>
      </div>
    </Surface>
  );
}
