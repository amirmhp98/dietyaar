'use client';

import { useState, useTransition } from 'react';
import { Pencil, User } from 'lucide-react';
import { updateProfileAction } from '@/actions/profile.actions';
import {
  Button,
  FormField,
  Input,
  RadioGroup,
  RadioGroupItem,
  Textarea,
  toast,
} from '@/components/UiComponents';
import { IconAction } from '@/components/product/IconAction';
import { SectionHeader } from '@/components/product/SectionHeader';
import { Surface } from '@/components/product/Surface';
import { formatLocalDate, formatNumber } from '@/lib/format';
import { t, tp } from '@/lib/t';
import { normalizeDigits } from '@/lib/text/normalize';
import { CM_PER_INCH, KG_PER_LB } from '@/lib/validations/profile';

type ProfileValues = {
  ageYears: number | null;
  sex: 'FEMALE' | 'MALE' | null;
  heightCm: number | null;
  weightKg: number | null;
  weightMeasuredAt: string | null;
  displayName: string | null;
  goal: string | null;
  restrictionsOriginal: string[];
  unitSystem: 'METRIC' | 'IMPERIAL';
};

const round1 = (n: number) => Math.round(n * 10) / 10;

function heightLabel(cm: number | null, unit: ProfileValues['unitSystem']) {
  if (cm === null) return t('settings.profile.notSet');
  if (unit === 'METRIC') return `${formatNumber(round1(cm))} cm`;
  const totalIn = cm / CM_PER_INCH;
  return `${Math.floor(totalIn / 12)} ft ${formatNumber(round1(totalIn % 12))} in`;
}

function weightLabel(kg: number | null, unit: ProfileValues['unitSystem']) {
  if (kg === null) return t('settings.profile.notSet');
  return unit === 'METRIC'
    ? `${formatNumber(round1(kg))} kg`
    : `${formatNumber(round1(kg / KG_PER_LB))} lb`;
}

/**
 * Profile (design-scope screen 8): the section header carries the Edit
 * icon action; the read view is a list surface of label / value rows and the
 * edit view an inline form (product spec § 5: values editable later).
 */
export function ProfileSection({ profile }: { profile: ProfileValues }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const imperial = profile.unitSystem === 'IMPERIAL';

  const [form, setForm] = useState({
    ageYears: profile.ageYears?.toString() ?? '',
    sex: profile.sex ?? 'FEMALE',
    height:
      profile.heightCm === null
        ? ''
        : String(round1(imperial ? profile.heightCm / CM_PER_INCH : profile.heightCm)),
    weight:
      profile.weightKg === null
        ? ''
        : String(round1(imperial ? profile.weightKg / KG_PER_LB : profile.weightKg)),
    weightMeasuredAt: profile.weightMeasuredAt ?? '',
    displayName: profile.displayName ?? '',
    goal: profile.goal ?? '',
    restrictions: profile.restrictionsOriginal.join('\n'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const height = Number(normalizeDigits(form.height));
    const weight = Number(normalizeDigits(form.weight));
    startTransition(async () => {
      const result = await updateProfileAction({
        ageYears: form.ageYears,
        sex: form.sex,
        heightCm: imperial ? round1(height * CM_PER_INCH) : height,
        weightKg: imperial ? round1(weight * KG_PER_LB) : weight,
        weightMeasuredAt: form.weightMeasuredAt,
        displayName: form.displayName,
        goal: form.goal,
        restrictions: form.restrictions
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean),
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(t('settings.saved'));
      setEditing(false);
    });
  }

  const header = (
    <SectionHeader
      icon={User}
      title={t('settings.profile.title')}
      id="settings-profile"
      trailing={
        editing ? undefined : (
          <IconAction label={t('settings.edit')} icon={Pencil} onClick={() => setEditing(true)} />
        )
      }
    />
  );

  if (!editing) {
    return (
      <section className="space-y-3" aria-labelledby="settings-profile">
        {header}
        <Surface variant="list">
          <dl className="divide-y divide-border text-sm" data-testid="profile-summary">
            <Row
              label={t('settings.profile.age')}
              value={
                profile.ageYears === null
                  ? t('settings.profile.notSet')
                  : tp('settings.profile.years', profile.ageYears)
              }
            />
            <Row
              label={t('settings.profile.sex')}
              value={
                profile.sex ? t(`onboarding.sex.${profile.sex}`) : t('settings.profile.notSet')
              }
            />
            <Row
              label={t('settings.profile.height')}
              value={heightLabel(profile.heightCm, profile.unitSystem)}
            />
            <Row
              label={t('settings.profile.weight')}
              value={`${weightLabel(profile.weightKg, profile.unitSystem)}${profile.weightMeasuredAt ? ` · ${formatLocalDate(profile.weightMeasuredAt)}` : ''}`}
            />
            <Row
              label={t('settings.profile.displayName')}
              value={profile.displayName || t('settings.profile.notSet')}
              bidi
            />
            <Row
              label={t('settings.profile.goal')}
              value={profile.goal || t('settings.profile.notSet')}
              bidi
            />
            <Row
              label={t('settings.profile.restrictions')}
              value={
                profile.restrictionsOriginal.length
                  ? profile.restrictionsOriginal.join(', ')
                  : t('settings.profile.notSet')
              }
              bidi
            />
          </dl>
        </Surface>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-labelledby="settings-profile">
      {header}
      <form onSubmit={submit} className="space-y-4 rounded-card border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('settings.profile.age')} required error={fieldErrors.ageYears?.[0]}>
            <Input
              inputMode="numeric"
              dir="auto"
              value={form.ageYears}
              onChange={(e) => setForm({ ...form, ageYears: e.target.value })}
              className="h-11"
            />
          </FormField>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t('settings.profile.sex')}</span>
            <RadioGroup
              value={form.sex}
              onValueChange={(v) => setForm({ ...form, sex: v as 'FEMALE' | 'MALE' })}
              className="flex h-11 items-center gap-4"
            >
              {(['FEMALE', 'MALE'] as const).map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={s} /> {t(`onboarding.sex.${s}`)}
                </label>
              ))}
            </RadioGroup>
          </div>
          <FormField
            label={`${t('settings.profile.height')} (${imperial ? 'in' : 'cm'})`}
            required
            error={fieldErrors.heightCm?.[0]}
          >
            <Input
              inputMode="decimal"
              dir="auto"
              value={form.height}
              onChange={(e) => setForm({ ...form, height: e.target.value })}
              className="h-11"
            />
          </FormField>
          <FormField
            label={`${t('settings.profile.weight')} (${imperial ? 'lb' : 'kg'})`}
            required
            error={fieldErrors.weightKg?.[0]}
          >
            <Input
              inputMode="decimal"
              dir="auto"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              className="h-11"
            />
          </FormField>
        </div>
        <FormField
          label={t('settings.profile.weightMeasuredAt')}
          required
          error={fieldErrors.weightMeasuredAt?.[0]}
        >
          <Input
            type="date"
            value={form.weightMeasuredAt}
            onChange={(e) => setForm({ ...form, weightMeasuredAt: e.target.value })}
            className="h-11"
          />
        </FormField>
        <FormField
          label={t('settings.profile.displayName')}
          helperText={t('settings.profile.displayNameHint')}
          error={fieldErrors.displayName?.[0]}
        >
          <Input
            dir="auto"
            maxLength={40}
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            className="h-11"
          />
        </FormField>
        <FormField
          label={t('settings.profile.goal')}
          helperText={t('settings.profile.goalHint')}
          error={fieldErrors.goal?.[0]}
        >
          <Input
            dir="auto"
            maxLength={200}
            value={form.goal}
            onChange={(e) => setForm({ ...form, goal: e.target.value })}
            className="h-11"
          />
        </FormField>
        <FormField
          label={t('settings.profile.restrictions')}
          helperText={t('settings.profile.restrictionsHint')}
          error={fieldErrors.restrictions?.[0]}
        >
          <Textarea
            dir="auto"
            rows={3}
            value={form.restrictions}
            onChange={(e) => setForm({ ...form, restrictions: e.target.value })}
          />
        </FormField>
        {/* Save stays outline: the floating Log meal button is the page's filled primary (decision 025). */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setEditing(false)}
          >
            {t('settings.cancel')}
          </Button>
          <Button type="submit" variant="outline" loading={pending}>
            {pending ? t('settings.saving') : t('settings.save')}
          </Button>
        </div>
      </form>
    </section>
  );
}

function Row({ label, value, bidi }: { label: string; value: string; bidi?: boolean }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end font-medium">{bidi ? <bdi>{value}</bdi> : value}</dd>
    </div>
  );
}
