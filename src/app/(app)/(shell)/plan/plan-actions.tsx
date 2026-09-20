'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { deletePlanAction, startPlanEditAction } from '@/actions/plan.actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  FormField,
  Input,
  toast,
} from '@/components/UiComponents';
import { IconAction } from '@/components/product/IconAction';
import { t } from '@/lib/t';

/**
 * My plan actions as one row of icon actions (decision 025): Edit (→ review
 * flow, outline), Replace (→ Add your plan, ghost), Delete (ghost,
 * destructive, typed confirmation). The labels are the accessible names.
 */
export function PlanActions({ planName }: { planName: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [pending, startTransition] = useTransition();
  const expected = planName?.trim() ?? '';
  const matches = expected === '' || typed.trim().toLowerCase() === expected.toLowerCase();

  function edit() {
    startTransition(async () => {
      const result = await startPlanEditAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push('/plan/review');
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deletePlanAction({ confirmation: expected === '' ? 'delete' : typed });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(t('plan.page.deleted'));
      router.refresh();
    });
  }

  return (
    <div
      className="flex shrink-0 items-center gap-1"
      role="group"
      aria-label={t('plan.page.actions')}
    >
      <IconAction
        label={t('plan.page.edit')}
        icon={Pencil}
        variant="outline"
        disabled={pending}
        onClick={edit}
        data-testid="plan-edit"
      />
      <Button asChild variant="ghost" size="icon">
        <Link
          href="/plan/add"
          aria-label={t('plan.page.replace')}
          title={t('plan.page.replace')}
          data-testid="plan-replace"
        >
          <RefreshCw aria-hidden="true" />
        </Link>
      </Button>
      <IconAction
        label={t('plan.page.delete')}
        icon={Trash2}
        className="text-destructive-ink hover:text-destructive-ink"
        disabled={pending}
        onClick={() => setOpen(true)}
        data-testid="plan-delete"
      />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {expected
                ? // FSI…PDI isolate the name so the question mark stays put beside RTL names.
                  t('plan.page.deleteTitle', { name: `⁨${expected}⁩` })
                : t('plan.page.deleteTitleUnnamed')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {expected ? t('plan.page.deleteBody') : t('plan.page.deleteBodyUnnamed')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {expected ? (
            <FormField label={t('plan.page.deleteConfirmLabel')}>
              <Input
                dir="auto"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="h-11"
              />
            </FormField>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('plan.page.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!matches || pending}
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
            >
              {t('plan.page.deleteAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
