'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UiComponents';
import { t } from '@/lib/t';
import { USER_ROLES, userRoleLabel, type UserRoleValue } from '@/lib/validations/user';

export function UserRoleSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: UserRoleValue;
  onChange: (value: UserRoleValue) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as UserRoleValue)} disabled={disabled}>
      <SelectTrigger id={id} aria-label={t('users.field.role')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {USER_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {userRoleLabel(role)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
