import { Fragment, type ReactNode } from 'react';
import type { FoodName } from '@/lib/rubric/types';

/**
 * A food or slot name inside an English sentence: "Eaten before ناهار". The
 * name is quoted as the user wrote it, isolated in <bdi>; the English label
 * is never shown (decision 10). `NameLabel` stays the block/row form.
 */
export function InlineName({ name }: { name: FoodName }) {
  return <bdi>{nameText(name)}</bdi>;
}

/** The plain-text form for places that cannot hold markup (aria labels, list joins). */
export function nameText(name: FoodName): string {
  return name.originalName.trim() || name.englishLabel.trim();
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
