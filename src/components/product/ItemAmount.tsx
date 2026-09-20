import { formatNumber } from '@/lib/format';
import { t } from '@/lib/t';
import { formatAmount, isCountUnit } from '@/lib/units';
import { cn } from '@/lib/utils';

/**
 * The amount that precedes an item's name (decision 024): "2 ×" for pieces
 * (the name completes the phrase), "1 slice ·", "150 g ·", "1 glass ·".
 * Nothing when the quantity is unknown. Always an LTR run, so digits and the
 * unit never flip around an RTL name.
 */
export function AmountPrefix({
  quantity,
  unit,
  className,
}: {
  quantity: number | null;
  unit: string | null;
  className?: string;
}) {
  if (quantity === null) return null;
  const amount = formatAmount(quantity, unit);
  return (
    <span dir="ltr" className={cn('shrink-0 font-medium tabular-nums', className)}>
      {unit === 'piece' ? amount : `${amount} ·`}
    </span>
  );
}

/** "≈ 180 g each" under a counted item whose grams per unit are known. */
export function GramsEach({
  unit,
  unitGrams,
  className,
}: {
  unit: string | null;
  unitGrams: number | null;
  className?: string;
}) {
  if (!isCountUnit(unit) || unitGrams === null) return null;
  return (
    <span dir="ltr" className={cn('text-xs text-muted-foreground', className)}>
      {t('unit.gramsEach', { grams: formatNumber(unitGrams, { maximumFractionDigits: 1 }) })}
    </span>
  );
}
