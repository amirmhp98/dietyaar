'use client';

import { ArrowRight, PencilLine, ShieldCheck } from 'lucide-react';
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/UiComponents';
import { Surface } from '@/components/product/Surface';
import { t } from '@/lib/t';

export type AiNoticeKindKey = 'PLAN' | 'MEAL_TEXT' | 'MEAL_PHOTO';

/**
 * AI-processing notice (product spec § 15): shown once per kind before the
 * first request, with a manual alternative. A note surface with the shield,
 * one calm sentence, Continue (the only filled action while it is open) and
 * the manual path as a ghost. The parent decides when to show it.
 */
export function AiNoticeSheet({
  kind,
  open,
  onContinue,
  onManual,
  onOpenChange,
}: {
  kind: AiNoticeKindKey;
  open: boolean;
  onContinue: () => void;
  onManual: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const body = kind === 'PLAN' ? t('aiNotice.plan') : t('aiNotice.meal');
  const manual = kind === 'PLAN' ? t('aiNotice.setUpManually') : t('aiNotice.enterManually');
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-card" data-testid="ai-notice">
        <SheetHeader className="text-start">
          <SheetTitle className="font-display">{t('aiNotice.title')}</SheetTitle>
        </SheetHeader>
        <Surface variant="note" className="mt-3 flex items-start gap-3">
          <ShieldCheck
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <SheetDescription className="text-base leading-relaxed text-foreground">
            {body}
          </SheetDescription>
        </Surface>
        <SheetFooter className="mt-4 gap-2">
          <Button type="button" variant="ghost" onClick={onManual}>
            <PencilLine aria-hidden="true" />
            {manual}
          </Button>
          <Button type="button" onClick={onContinue}>
            {t('aiNotice.continue')}
            <ArrowRight className="rtl:-scale-x-100" aria-hidden="true" />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
