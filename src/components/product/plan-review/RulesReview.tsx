'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge, Button, RadioGroup, RadioGroupItem } from '@/components/UiComponents';
import { t, tp } from '@/lib/t';
import { RULE_TRACKING, type DraftNote, type DraftRule } from '@/lib/validations/plan';
import { SourceExcerpt } from './SourceExcerpt';

/**
 * Screen 8c: every rule with its source excerpt and three choices (Track it /
 * Keep as a note / Don't compare); conflicts flagged at the rule; unsupported
 * schedules kept as notes; the "Not automatically tracked" list; and Confirm
 * plan with the "N meals affected" line when past meals are linked.
 */
export function RulesReview({
  rules,
  notes,
  affectedMeals,
  saving,
  onConfirm,
  onBack,
}: {
  rules: DraftRule[];
  notes: DraftNote[];
  /** Null while unknown; the line shows only when > 0. */
  affectedMeals: number | null;
  saving: boolean;
  onConfirm: (rules: DraftRule[]) => void;
  onBack?: () => void;
}) {
  const [list, setList] = useState(rules);

  function setTracking(key: string, tracking: DraftRule['tracking']) {
    setList((rules) => rules.map((r) => (r.key === key ? { ...r, tracking } : r)));
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t('plan.review.rulesIntro')}</p>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('plan.review.noRules')}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((rule) => (
            <RuleCard key={rule.key} rule={rule} onChange={(v) => setTracking(rule.key, v)} />
          ))}
        </ul>
      )}
      {notes.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">{t('plan.review.notes.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('plan.review.notes.hint')}</p>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {notes.map((note) => (
              <li key={note.key} className="space-y-1 p-3 text-sm">
                <p dir="auto">
                  <bdi>{note.originalText}</bdi>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(`plan.review.notes.reason.${note.reason}`)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-sm text-muted-foreground">{t('plan.review.changeLater')}</p>
      {affectedMeals !== null && affectedMeals > 0 ? (
        <p className="text-sm" data-testid="affected-meals">
          {tp('plan.review.affected', affectedMeals)}
        </p>
      ) : null}
      <div className="grid gap-3">
        <Button
          type="button"
          className="h-11 w-full"
          loading={saving}
          onClick={() => onConfirm(list)}
          data-testid="confirm-plan"
        >
          {t('plan.review.confirm')}
        </Button>
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full"
            disabled={saving}
            onClick={onBack}
          >
            {t('plan.review.back')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  onChange,
}: {
  rule: DraftRule;
  onChange: (tracking: DraftRule['tracking']) => void;
}) {
  const unsupported = rule.unsupportedReason !== null;
  return (
    <li className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t(`plan.review.rule.kind.${rule.kind}`)}</Badge>
          {rule.isConflicting ? (
            <Badge variant="warning">
              <AlertTriangle className="me-1 size-3" aria-hidden="true" />
              {t('plan.review.rule.conflicting')}
            </Badge>
          ) : null}
        </div>
        <p className="text-base" dir="auto">
          <bdi>{rule.originalText}</bdi>
        </p>
      </div>
      {rule.sourceExcerpt && rule.sourceExcerpt !== rule.originalText ? (
        <SourceExcerpt text={rule.sourceExcerpt} />
      ) : null}
      {unsupported ? (
        <p className="text-xs text-muted-foreground">
          {rule.unsupportedReason
            ? t('plan.review.rule.unsupported', { reason: rule.unsupportedReason })
            : t('plan.review.rule.unsupportedGeneric')}
        </p>
      ) : null}
      <RadioGroup
        value={rule.tracking}
        onValueChange={(v) => onChange(v as DraftRule['tracking'])}
        className="grid gap-2"
        aria-label={rule.originalText}
      >
        {RULE_TRACKING.map((choice) => {
          const disabled = choice === 'TRACK' && unsupported;
          return (
            <label
              key={choice}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 text-sm has-[[data-state=checked]]:border-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
            >
              <RadioGroupItem value={choice} disabled={disabled} />
              {t(`plan.review.rule.${trackingKey(choice)}`)}
            </label>
          );
        })}
      </RadioGroup>
    </li>
  );
}

function trackingKey(choice: DraftRule['tracking']): 'track' | 'note' | 'ignore' {
  return choice === 'TRACK' ? 'track' : choice === 'NOTE' ? 'note' : 'ignore';
}
