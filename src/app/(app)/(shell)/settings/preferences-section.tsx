'use client';

import { useState, useTransition } from 'react';
import { updatePreferencesAction } from '@/actions/profile.actions';
import {
  FormField,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@/components/UiComponents';
import { t } from '@/lib/t';
import { setAppearance } from '@/lib/theme';

type Props = {
  unitSystem: 'METRIC' | 'IMPERIAL';
  weekStart: number;
  appearance: 'SYSTEM' | 'LIGHT' | 'DARK';
};

const WEEKDAY_ORDER = [6, 0, 1, 2, 3, 4, 5];

function weekdayName(day: number): string {
  // 2026-09-06 is a Sunday; any known Sunday works for naming.
  const base = Date.UTC(2026, 8, 6 + day);
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(base);
}

/** Each control saves on change; appearance also applies immediately (no flash on the next load). */
export function PreferencesSection(props: Props) {
  const [values, setValues] = useState(props);
  const [, startTransition] = useTransition();

  function save(patch: Partial<Props>) {
    const next = { ...values, ...patch };
    setValues(next);
    startTransition(async () => {
      const result = await updatePreferencesAction(patch);
      if (!result.ok) {
        toast.error(result.error);
        setValues(values);
        return;
      }
      toast.success(t('settings.saved'));
    });
  }

  return (
    <div className="space-y-5 rounded-card border border-border bg-card p-4">
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{t('settings.preferences.appearance')}</span>
        <RadioGroup
          value={values.appearance}
          onValueChange={(v) => {
            const appearance = v as Props['appearance'];
            setAppearance(appearance.toLowerCase() as 'system' | 'light' | 'dark');
            save({ appearance });
          }}
          className="grid grid-cols-3 gap-2"
          aria-label={t('settings.preferences.appearance')}
        >
          {(['SYSTEM', 'LIGHT', 'DARK'] as const).map((option) => (
            <label
              key={option}
              className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-border text-sm font-medium hover:bg-accent has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-tint-2"
            >
              <RadioGroupItem value={option} className="sr-only" />
              {t(`settings.preferences.appearance.${option}`)}
            </label>
          ))}
        </RadioGroup>
      </div>

      <FormField label={t('settings.preferences.units')} id="pref-units">
        <Select
          value={values.unitSystem}
          onValueChange={(v) => save({ unitSystem: v as Props['unitSystem'] })}
        >
          <SelectTrigger className="h-11" id="pref-units">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="METRIC">{t('settings.preferences.units.METRIC')}</SelectItem>
            <SelectItem value="IMPERIAL">{t('settings.preferences.units.IMPERIAL')}</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField
        label={t('settings.preferences.weekStart')}
        helperText={t('settings.preferences.weekStartHint')}
        id="pref-week-start"
      >
        <Select
          value={String(values.weekStart)}
          onValueChange={(v) => save({ weekStart: Number(v) })}
        >
          <SelectTrigger className="h-11" id="pref-week-start">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEEKDAY_ORDER.map((day) => (
              <SelectItem key={day} value={String(day)}>
                {weekdayName(day)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    </div>
  );
}
