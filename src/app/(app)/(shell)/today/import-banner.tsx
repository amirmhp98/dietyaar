'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { retryPlanImportAction } from '@/actions/plan.actions';
import { toast } from '@/components/UiComponents';
import {
  ImportStatusBanner,
  type ImportBannerState,
} from '@/components/product/ImportStatusBanner';
import { t } from '@/lib/t';

/** The plan-import banner above the plan block; the plan routes belong to the plan module. */
export function ImportBanner({ state }: { state: ImportBannerState }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function retry() {
    startTransition(async () => {
      const result = await retryPlanImportAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t('day.plan.import.retried'));
      router.refresh();
    });
  }

  return (
    <ImportStatusBanner
      state={state}
      onReview={() => router.push('/plan/review')}
      onRetry={retry}
      onManual={() => router.push('/plan/add')}
    />
  );
}
