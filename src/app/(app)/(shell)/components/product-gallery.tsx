'use client';

import { useState } from 'react';
import { Button } from '@/components/UiComponents';
import { AiNoticeSheet } from '@/components/product/AiNoticeSheet';
import { CompletenessCheckbox } from '@/components/product/CompletenessCheckbox';
import { DifferenceChip } from '@/components/product/DifferenceChip';
import { Disclosure } from '@/components/product/Disclosure';
import { ImportStatusBanner } from '@/components/product/ImportStatusBanner';
import { NameLabel } from '@/components/product/NameLabel';
import { ScoreCard } from '@/components/product/ScoreCard';

/** Product components with Persian sample text, both themes (decision 019: the visual regression surface). */
export function ProductGallery() {
  const [notice, setNotice] = useState(false);
  const [checked, setChecked] = useState(true);
  return (
    <section
      className="mb-10 space-y-6 rounded-xl border border-border p-4"
      data-testid="product-gallery"
    >
      <h2 className="text-lg font-semibold">Product components</h2>
      <div className="flex flex-wrap gap-6">
        <NameLabel originalName="نان سنگک" englishLabel="sangak bread" />
        <NameLabel originalName="جوجه کباب" englishLabel="joojeh kabab" inline />
        <NameLabel originalName="Oats" englishLabel="oats" />
        <NameLabel originalName="ناهار" englishLabel="Lunch" size="lg" />
      </div>
      <div className="flex flex-wrap gap-2">
        <DifferenceChip kind="PORTION_MORE">
          More than planned (120 g instead of 80 g)
        </DifferenceChip>
        <DifferenceChip kind="ORDER">Eaten before ناهار (Lunch)</DifferenceChip>
        <DifferenceChip kind="ADDED">Added: همبرگر (burger)</DifferenceChip>
        <DifferenceChip kind="CROSS_SLOT">This is a lunch option</DifferenceChip>
      </div>
      <ScoreCard
        ongoing
        score={{
          dayScore: 78,
          showNumber: true,
          band: 'MOSTLY',
          coverage: {
            prescribed: 5,
            recorded: 2,
            scored: 2,
            skipped: 1,
            needsReview: 0,
            notRecorded: 2,
          },
          completeByDefault: false,
          nutritionComponent: null,
          mealMean: 78,
        }}
      >
        <Disclosure label="Why this score" className="mt-3">
          <p className="text-sm text-muted-foreground">
            صبحانه (Breakfast) · food 50 · portion 15 · order 20
          </p>
        </Disclosure>
      </ScoreCard>
      <ImportStatusBanner state="PENDING" />
      <ImportStatusBanner state="READY" onReview={() => undefined} />
      <ImportStatusBanner state="FAILED" onRetry={() => undefined} onManual={() => undefined} />
      <CompletenessCheckbox checked={checked} onChange={setChecked} />
      <Button type="button" variant="outline" onClick={() => setNotice(true)}>
        Open AI notice
      </Button>
      <AiNoticeSheet
        kind="MEAL_TEXT"
        open={notice}
        onOpenChange={setNotice}
        onContinue={() => setNotice(false)}
        onManual={() => setNotice(false)}
      />
    </section>
  );
}
