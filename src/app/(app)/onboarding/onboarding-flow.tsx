'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { ArrowLeft } from 'lucide-react';
import { deleteUnderageAccountAction } from '@/actions/account.actions';
import { saveOnboardingStepAction } from '@/actions/profile.actions';
import {
  Button,
  FormField,
  Input,
  Progress,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
  toast,
} from '@/components/UiComponents';
import { t } from '@/lib/t';
import { normalizeDigits } from '@/lib/text/normalize';
import {
  CM_PER_INCH,
  KG_PER_LB,
  MIN_AGE,
  type OnboardingInputStep,
} from '@/lib/validations/profile';
import type { OnboardingState } from '@/services/profile.service';
import type { OnboardingStep } from '@prisma/client';
import { ONBOARDING_TOTAL_STEPS, progressPercent } from './plan/plan-screen';

const STEPS: OnboardingInputStep[] = [
  'AGE',
  'SEX',
  'HEIGHT',
  'WEIGHT',
  'TIME_ZONE',
  'DISPLAY_NAME',
];
type Values = OnboardingState['values'];

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Inches keep two decimals so cm → ft/in → cm round-trips exactly. */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function listTimeZones(): string[] {
  try {
    const zones = Intl.supportedValuesOf('timeZone');
    return zones.includes('UTC') ? zones : ['UTC', ...zones];
  } catch {
    return ['UTC'];
  }
}

export function OnboardingFlow({
  initialStep,
  initialValues,
}: {
  initialStep: OnboardingStep;
  initialValues: Values;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initialValues);
  const [step, setStep] = useState<OnboardingInputStep>(
    STEPS.includes(initialStep as OnboardingInputStep)
      ? (initialStep as OnboardingInputStep)
      : 'DISPLAY_NAME',
  );
  const [error, setError] = useState<string | null>(null);
  const [underage, setUnderage] = useState(false);
  const [pending, startTransition] = useTransition();

  const index = STEPS.indexOf(step);

  useEffect(() => {
    if (initialStep === 'PLAN' || initialStep === 'REVIEW' || initialStep === 'READY')
      router.replace('/onboarding/plan');
  }, [initialStep, router]);

  function save(
    currentStep: OnboardingInputStep,
    payload: Record<string, unknown>,
    patch: Partial<Values>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await saveOnboardingStepAction(currentStep, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if ('underage' in result.data) {
        setUnderage(true);
        return;
      }
      setValues((v) => ({ ...v, ...patch }));
      const next = result.data.nextStep;
      if (
        STEPS.includes(next as OnboardingInputStep) &&
        STEPS.indexOf(next as OnboardingInputStep) > index
      ) {
        setStep(next as OnboardingInputStep);
      } else if (index < STEPS.length - 1) {
        setStep(STEPS[index + 1]);
      } else {
        router.push('/onboarding/plan');
      }
    });
  }

  function back() {
    setError(null);
    if (index > 0) setStep(STEPS[index - 1]);
  }

  if (underage) {
    return (
      <Screen current={1} title={t('onboarding.age.stopTitle')}>
        <p className="text-sm text-muted-foreground">{t('onboarding.age.stopBody')}</p>
        <Button
          variant="destructive"
          className="h-11 w-full"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteUnderageAccountAction();
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              router.replace('/signup');
            })
          }
        >
          {t('onboarding.age.deleteAccount')}
        </Button>
      </Screen>
    );
  }

  const common = { pending, error, onBack: index > 0 ? back : undefined };

  switch (step) {
    case 'AGE':
      return (
        <AgeScreen
          key="age"
          {...common}
          value={values.ageYears}
          onSave={(ageYears, raw) => save('AGE', { ageYears: raw }, { ageYears })}
        />
      );
    case 'SEX':
      return (
        <SexScreen
          key="sex"
          {...common}
          value={values.sex}
          onSave={(sex) => save('SEX', { sex }, { sex })}
        />
      );
    case 'HEIGHT':
      return (
        <HeightScreen
          key="height"
          {...common}
          value={values.heightCm}
          unitSystem={values.unitSystem}
          onSave={(heightCm, unitSystem) =>
            save('HEIGHT', { heightCm, unitSystem }, { heightCm, unitSystem })
          }
        />
      );
    case 'WEIGHT':
      return (
        <WeightScreen
          key="weight"
          {...common}
          value={values.weightKg}
          unitSystem={values.unitSystem}
          onSave={(weightKg, unitSystem) =>
            save('WEIGHT', { weightKg, unitSystem }, { weightKg, unitSystem })
          }
        />
      );
    case 'TIME_ZONE':
      return (
        <TimeZoneScreen
          key="tz"
          {...common}
          value={values.timeZone}
          onSave={(timeZone) => save('TIME_ZONE', { timeZone }, { timeZone })}
        />
      );
    case 'DISPLAY_NAME':
      return (
        <NameScreen
          key="name"
          {...common}
          value={values.displayName}
          onSave={(displayName) =>
            save('DISPLAY_NAME', { displayName: displayName ?? '' }, { displayName })
          }
        />
      );
  }
}

// ─── Shared screen chrome ───────────────────────────────────────────────────

function Screen({
  current,
  title,
  children,
  onBack,
}: {
  current: number;
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 pb-8 pt-6">
      <div className="space-y-2">
        <div className="flex h-11 items-center gap-2">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-label={t('onboarding.back')}
              onClick={onBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {t('onboarding.progress', { current, total: ONBOARDING_TOTAL_STEPS })}
          </span>
        </div>
        <Progress
          value={progressPercent(current)}
          aria-label={t('onboarding.progress', { current, total: ONBOARDING_TOTAL_STEPS })}
        />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="space-y-5">{children}</div>
    </main>
  );
}

type ScreenProps = { pending: boolean; error: string | null; onBack?: () => void };

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-error">
      {error}
    </p>
  ) : null;
}

function AgeScreen({
  value,
  onSave,
  pending,
  error,
  onBack,
}: ScreenProps & { value: number | null; onSave: (age: number, raw: string) => void }) {
  const [raw, setRaw] = useState(value?.toString() ?? '');
  return (
    <Screen current={1} title={t('onboarding.age.title')} onBack={onBack}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(Number(normalizeDigits(raw)), raw);
        }}
      >
        <FormField
          label={t('onboarding.age.label')}
          required
          error={error ?? undefined}
          helperText={t('onboarding.age.why')}
        >
          <Input
            inputMode="numeric"
            dir="auto"
            autoFocus
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="h-11 text-lg"
          />
        </FormField>
        <Button
          type="submit"
          className="h-11 w-full"
          loading={pending}
          disabled={raw.trim() === ''}
        >
          {t('onboarding.continue')}
        </Button>
        <p className="sr-only">
          {t('onboarding.age.stopTitle')} {MIN_AGE}
        </p>
      </form>
    </Screen>
  );
}

function SexScreen({
  value,
  onSave,
  pending,
  error,
  onBack,
}: ScreenProps & { value: 'FEMALE' | 'MALE' | null; onSave: (sex: 'FEMALE' | 'MALE') => void }) {
  return (
    <Screen current={2} title={t('onboarding.sex.title')} onBack={onBack}>
      <RadioGroup
        value={value ?? undefined}
        onValueChange={(v) => onSave(v as 'FEMALE' | 'MALE')}
        className="grid gap-3"
        aria-label={t('onboarding.sex.title')}
      >
        {(['FEMALE', 'MALE'] as const).map((option) => (
          <label
            key={option}
            className="flex h-14 cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 text-base font-medium hover:bg-accent has-[[data-state=checked]]:border-primary"
          >
            <RadioGroupItem value={option} disabled={pending} />
            {t(`onboarding.sex.${option}`)}
          </label>
        ))}
      </RadioGroup>
      <ErrorLine error={error} />
    </Screen>
  );
}

function UnitToggle({
  value,
  onChange,
}: {
  value: 'METRIC' | 'IMPERIAL';
  onChange: (v: 'METRIC' | 'IMPERIAL') => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as 'METRIC' | 'IMPERIAL')}
      aria-label={t('onboarding.units.label')}
      className="justify-start"
    >
      <ToggleGroupItem value="METRIC" className="h-11 px-4">
        {t('onboarding.units.metric')}
      </ToggleGroupItem>
      <ToggleGroupItem value="IMPERIAL" className="h-11 px-4">
        {t('onboarding.units.imperial')}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

function HeightScreen({
  value,
  unitSystem,
  onSave,
  pending,
  error,
  onBack,
}: ScreenProps & {
  value: number | null;
  unitSystem: 'METRIC' | 'IMPERIAL';
  onSave: (cm: number, unit: 'METRIC' | 'IMPERIAL') => void;
}) {
  const [unit, setUnit] = useState(unitSystem);
  const [cm, setCm] = useState(value === null ? '' : String(round1(value)));
  const [ft, setFt] = useState(value === null ? '' : String(Math.floor(value / CM_PER_INCH / 12)));
  const [inch, setInch] = useState(
    value === null ? '' : String(round1((value / CM_PER_INCH) % 12)),
  );

  /** The toggle converts the displayed value; it never reinterprets it. */
  function switchUnit(next: 'METRIC' | 'IMPERIAL') {
    if (next === unit) return;
    if (next === 'IMPERIAL') {
      const n = Number(normalizeDigits(cm));
      if (Number.isFinite(n) && cm !== '') {
        const totalIn = n / CM_PER_INCH;
        setFt(String(Math.floor(totalIn / 12)));
        setInch(String(round2(totalIn % 12)));
      }
    } else {
      const n = Number(normalizeDigits(ft)) * 12 + Number(normalizeDigits(inch || '0'));
      if (Number.isFinite(n) && ft !== '') setCm(String(round1(n * CM_PER_INCH)));
    }
    setUnit(next);
  }

  const heightCm = useMemo(() => {
    if (unit === 'METRIC') return Number(normalizeDigits(cm));
    return round1(
      (Number(normalizeDigits(ft)) * 12 + Number(normalizeDigits(inch || '0'))) * CM_PER_INCH,
    );
  }, [unit, cm, ft, inch]);

  return (
    <Screen current={3} title={t('onboarding.height.title')} onBack={onBack}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(heightCm, unit);
        }}
      >
        <UnitToggle value={unit} onChange={switchUnit} />
        {unit === 'METRIC' ? (
          <FormField label={t('onboarding.height.cm')} required error={error ?? undefined}>
            <Input
              inputMode="decimal"
              dir="auto"
              autoFocus
              value={cm}
              onChange={(e) => setCm(e.target.value)}
              className="h-11 text-lg"
            />
          </FormField>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('onboarding.height.ft')} required error={error ?? undefined}>
              <Input
                inputMode="numeric"
                dir="auto"
                autoFocus
                value={ft}
                onChange={(e) => setFt(e.target.value)}
                className="h-11 text-lg"
              />
            </FormField>
            <FormField label={t('onboarding.height.in')}>
              <Input
                inputMode="decimal"
                dir="auto"
                value={inch}
                onChange={(e) => setInch(e.target.value)}
                className="h-11 text-lg"
              />
            </FormField>
          </div>
        )}
        <Button
          type="submit"
          className="h-11 w-full"
          loading={pending}
          disabled={!Number.isFinite(heightCm) || heightCm <= 0}
        >
          {t('onboarding.continue')}
        </Button>
      </form>
    </Screen>
  );
}

function WeightScreen({
  value,
  unitSystem,
  onSave,
  pending,
  error,
  onBack,
}: ScreenProps & {
  value: number | null;
  unitSystem: 'METRIC' | 'IMPERIAL';
  onSave: (kg: number, unit: 'METRIC' | 'IMPERIAL') => void;
}) {
  const [unit, setUnit] = useState(unitSystem);
  const [raw, setRaw] = useState(
    value === null ? '' : String(round1(unitSystem === 'IMPERIAL' ? value / KG_PER_LB : value)),
  );

  function switchUnit(next: 'METRIC' | 'IMPERIAL') {
    if (next === unit) return;
    const n = Number(normalizeDigits(raw));
    if (raw !== '' && Number.isFinite(n))
      setRaw(String(round1(next === 'IMPERIAL' ? n / KG_PER_LB : n * KG_PER_LB)));
    setUnit(next);
  }

  const kg =
    unit === 'METRIC'
      ? Number(normalizeDigits(raw))
      : round1(Number(normalizeDigits(raw)) * KG_PER_LB);

  return (
    <Screen current={4} title={t('onboarding.weight.title')} onBack={onBack}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(kg, unit);
        }}
      >
        <UnitToggle value={unit} onChange={switchUnit} />
        <FormField
          label={unit === 'METRIC' ? t('onboarding.weight.kg') : t('onboarding.weight.lb')}
          required
          error={error ?? undefined}
        >
          <Input
            inputMode="decimal"
            dir="auto"
            autoFocus
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="h-11 text-lg"
          />
        </FormField>
        <Button
          type="submit"
          className="h-11 w-full"
          loading={pending}
          disabled={raw.trim() === '' || !Number.isFinite(kg)}
        >
          {t('onboarding.continue')}
        </Button>
      </form>
    </Screen>
  );
}

function TimeZoneScreen({
  value,
  onSave,
  pending,
  error,
  onBack,
}: ScreenProps & { value: string | null; onSave: (zone: string) => void }) {
  const detected = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  }, []);
  const [zone, setZone] = useState(value ?? detected);
  const [changing, setChanging] = useState(false);
  const zones = useMemo(() => listTimeZones(), []);

  return (
    <Screen current={5} title={t('onboarding.timeZone.title')} onBack={onBack}>
      <p className="text-base">{t('onboarding.timeZone.detected', { zone })}</p>
      <p className="text-sm text-muted-foreground">{t('onboarding.timeZone.why')}</p>
      {changing ? (
        <FormField label={t('onboarding.timeZone.label')} id="onboarding-time-zone">
          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger className="h-11" id="onboarding-time-zone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      ) : null}
      <ErrorLine error={error} />
      <div className="grid gap-3">
        <Button
          type="button"
          className="h-11 w-full"
          loading={pending}
          onClick={() => onSave(zone)}
        >
          {t('onboarding.timeZone.looksRight')}
        </Button>
        {!changing ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={() => setChanging(true)}
          >
            {t('onboarding.timeZone.change')}
          </Button>
        ) : null}
      </div>
    </Screen>
  );
}

function NameScreen({
  value,
  onSave,
  pending,
  error,
  onBack,
}: ScreenProps & { value: string | null; onSave: (name: string | null) => void }) {
  const [name, setName] = useState(value ?? '');
  return (
    <Screen current={6} title={t('onboarding.name.title')} onBack={onBack}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name.trim() || null);
        }}
      >
        <FormField
          label={t('onboarding.name.label')}
          helperText={t('onboarding.name.hint')}
          error={error ?? undefined}
        >
          <Input
            dir="auto"
            autoFocus
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 text-lg"
            autoComplete="nickname"
          />
        </FormField>
        <div className="grid gap-3">
          <Button type="submit" className="h-11 w-full" loading={pending}>
            {t('onboarding.continue')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full"
            disabled={pending}
            onClick={() => onSave(null)}
          >
            {t('onboarding.skip')}
          </Button>
        </div>
      </form>
    </Screen>
  );
}
