'use client';

import { Check, CircleHelp } from 'lucide-react';
import { Input } from '@/components/UiComponents';
import { NameLabel } from '@/components/product/NameLabel';
import { SectionHeader } from '@/components/product/SectionHeader';
import { Surface } from '@/components/product/Surface';
import { t } from '@/lib/t';
import type { DraftFoodItem, DraftQuestion } from '@/lib/validations/meal';
import { cn } from '@/lib/utils';

/**
 * Grouped questions on the review (product spec § 7, D2e): one note surface
 * headed "A few quick checks", each question focused, its choices as pills
 * (the answered one tinted and checked) or a short free answer committed on
 * blur or Enter. Answering never starts a chat; the totals move as answers
 * come in.
 */
export function QuestionCard({
  questions,
  items,
  onAnswer,
}: {
  questions: DraftQuestion[];
  items: DraftFoodItem[];
  /** `committed` is false while free text is still being typed (no estimate yet). */
  onAnswer: (key: string, answer: string | null, committed: boolean) => void;
}) {
  if (questions.length === 0) return null;
  return (
    <Surface
      variant="note"
      as="section"
      aria-labelledby="meal-questions-title"
      data-testid="meal-questions"
      className="space-y-3"
    >
      <SectionHeader
        icon={CircleHelp}
        title={t('meal.review.questionsTitle')}
        level={3}
        id="meal-questions-title"
      />
      <ul className="space-y-4">
        {questions.map((question) => {
          const item = question.itemKey ? items.find((i) => i.key === question.itemKey) : null;
          const inputId = `question-${question.key}`;
          return (
            <li key={question.key} className="space-y-2">
              <p className="text-sm" id={`${inputId}-label`}>
                {item ? (
                  <NameLabel
                    originalName={item.originalName}
                    englishLabel={item.englishLabel}
                    size="sm"
                    className="inline me-1.5"
                  />
                ) : null}
                <bdi>{question.question}</bdi>
              </p>
              {question.choices.length > 0 ? (
                <div
                  className="flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-labelledby={`${inputId}-label`}
                >
                  {question.choices.map((choice) => {
                    const selected = question.answer === choice;
                    return (
                      <button
                        key={choice}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onAnswer(question.key, selected ? null : choice, true)}
                        className={cn(
                          'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          selected
                            ? 'border-primary bg-tint-2 font-medium'
                            : 'border-border bg-background hover:bg-tint-1',
                        )}
                      >
                        {selected ? (
                          <Check className="size-3.5 shrink-0" aria-hidden="true" />
                        ) : null}
                        <bdi>{choice}</bdi>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Input
                  id={inputId}
                  aria-labelledby={`${inputId}-label`}
                  dir="auto"
                  className="bg-background"
                  placeholder={t('meal.review.questionAnswerPlaceholder')}
                  value={question.answer ?? ''}
                  maxLength={300}
                  onChange={(event) => onAnswer(question.key, event.target.value || null, false)}
                  onBlur={(event) => onAnswer(question.key, event.target.value || null, true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onAnswer(question.key, event.currentTarget.value || null, true);
                    }
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </Surface>
  );
}
