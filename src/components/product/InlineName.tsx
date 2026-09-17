import { Fragment, type ReactNode } from 'react';
import type { FoodName } from '@/lib/rubric/types';

/**
 * A food or slot name inside an English sentence: "Eaten before ناهار (Lunch)".
 * The original is isolated in <bdi>; the English label follows in
 * parentheses when it differs. `NameLabel` stays the block/row form.
 */
export function InlineName({ name }: { name: FoodName }) {
  const original = name.originalName.trim();
  const english = name.englishLabel.trim();
  const same =
    !original || original.localeCompare(english, undefined, { sensitivity: 'base' }) === 0;
  if (same) return <span dir="ltr">{english || original}</span>;
  return (
    <>
      <bdi>{original}</bdi> <span dir="ltr">({english})</span>
    </>
  );
}

/** The plain-text form for places that cannot hold markup (aria labels, list joins). */
export function nameText(name: FoodName): string {
  const original = name.originalName.trim();
  const english = name.englishLabel.trim();
  const same =
    !original || original.localeCompare(english, undefined, { sensitivity: 'base' }) === 0;
  return same ? english || original : `${original} (${english})`;
}

/**
 * Fill a translated sentence with isolated names: `fillNames(t('x', { slot: '{slot}' }),
 * { slot: <InlineName … /> })`. Passing the literal placeholder through `t()` keeps
 * it in the text, so the sentence is split around it here.
 */
export function fillNames(template: string, nodes: Record<string, ReactNode>): ReactNode {
  const parts = template.split(/(\{\w+\})/g);
  return parts.map((part, index) => {
    const match = /^\{(\w+)\}$/.exec(part);
    const node = match ? nodes[match[1]] : undefined;
    return <Fragment key={index}>{node !== undefined ? node : part}</Fragment>;
  });
}

/** Several names in one sentence, comma-separated. */
export function InlineNames({ names }: { names: FoodName[] }) {
  return (
    <>
      {names.map((name, index) => (
        <Fragment key={`${name.originalName}-${index}`}>
          {index > 0 ? ', ' : null}
          <InlineName name={name} />
        </Fragment>
      ))}
    </>
  );
}
