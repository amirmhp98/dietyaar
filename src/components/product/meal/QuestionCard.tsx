'use client';

import { Input } from '@/components/UiComponents';
import { NameLabel } from '@/components/product/NameLabel';
import { t } from '@/lib/t';
import type { DraftFoodItem, DraftQuestion } from '@/lib/validations/meal';
import { cn } from '@/lib/utils';

/**
 * Grouped questions on the review (product spec § 7): each one focused, with
 * choices as chips or a short free answer; answering never starts a chat.
 */
export function QuestionCard({
  questions,
  items,
  onAnswer,
}: {
  questions: DraftQuestion[];
  items: DraftFoodItem[];
  onAnswer: (key: string, answer: string | null) => void;
}) {
  if (questions.length === 0) return null;
  return (
    <section
      className="rounded-xl border border-border bg-card p-4"
      aria-labelledby="meal-questions-title"
      data-testid="meal-questions"
    >
      <h3 id="meal-questions-title" className="text-sm font-semibold">
        {t('meal.review.questionsTitle')}
      </h3>
      <ul className="mt-3 space-y-4">
        {questions.map((question) => {
          const item = question.itemKey ? items.find((i) => i.key === question.itemKey) : null;
          const inputId = `question-${question.key}`;
          return (
            <li key={question.key} className="space-y-2">
              {item ? (
                <NameLabel
                  originalName={item.originalName}
                  englishLabel={item.englishLabel}
                  inline
                  size="sm"
                />
              ) : null}
              <p className="text-sm" id={`${inputId}-label`}>
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
                        onClick={() => onAnswer(question.key, selected ? null : choice)}
                        className={cn(
                          'min-h-11 rounded-full border px-4 text-sm transition-colors',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background hover:bg-accent',
                        )}
                      >
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
                  placeholder={t('meal.review.questionAnswerPlaceholder')}
                  value={question.answer ?? ''}
                  maxLength={300}
                  onChange={(event) => onAnswer(question.key, event.target.value || null)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
