import type { Ref } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/UiComponents';

/**
 * Icon-only action (design.md "Product UI" › Icon-first actions, decision
 * 025): the `label` is required and becomes the accessible name. `row` is
 * the 44 px target for list rows and headers; `dense` (36 px) is for editors
 * only. Never the filled primary — that stays with the one primary action.
 */
export function IconAction({
  label,
  icon: Icon,
  size = 'row',
  variant = 'ghost',
  type = 'button',
  ref,
  ...props
}: Omit<ButtonProps, 'size' | 'variant' | 'children' | 'aria-label'> & {
  label: string;
  icon: LucideIcon;
  size?: 'row' | 'dense';
  variant?: 'ghost' | 'outline';
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <Button
      ref={ref}
      type={type}
      variant={variant}
      size={size === 'dense' ? 'icon-sm' : 'icon'}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
