'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { discardPlanDraftAction, retryPlanImportAction } from '@/actions/plan.actions';
import {
  ImportStatusBanner,
  type ImportBannerState,
} from '@/components/product/ImportStatusBanner';
import { Button, toast } from '@/components/UiComponents';
import { t } from '@/lib/t';
import { useImportPolling } from '@/app/(app)/onboarding/plan/add-plan-flow';

/**
 * My plan's draft state (design-scope screen 6 "draft pending"): the import
 * banner for imports; a short line with Continue / Discard for an unfinished
 * manual set-up or unconfirmed edit.
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
    <div role="status" className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
      <p>
        {kind === 'MANUAL'
          ? t('plan.page.draft.unfinishedManual')
          : t('plan.page.draft.unfinishedEdit')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" className="h-11" onClick={() => router.push(continueHref)}>
          {t('plan.page.draft.continue')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
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
    </div>
  );
}
