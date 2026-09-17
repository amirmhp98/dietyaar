'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import {
  dismissTimeZoneHintAction,
  reportDeviceTimeZoneAction,
  updatePreferencesAction,
} from '@/actions/profile.actions';
import { Button, toast } from '@/components/UiComponents';
import { t } from '@/lib/t';

const subscribe = () => () => undefined;
const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone = () => null;

/**
 * Device time zone changed (product spec § 9 states): one dismissible line
 * offering to update the preference. History is never rewritten. Hidden once
 * dismissed for this device zone; a new device zone shows it again.
 */
export function TimeZoneHint({
  profileZone,
  lastSeenDeviceZone,
  dismissed,
}: {
  profileZone: string;
  lastSeenDeviceZone: string | null;
  dismissed: boolean;
}) {
  const device = useSyncExternalStore(subscribe, deviceZone, serverZone);
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  const reported = useRef<string | null>(null);

  useEffect(() => {
    if (!device || device === lastSeenDeviceZone || reported.current === device) return;
    reported.current = device;
    void reportDeviceTimeZoneAction({ timeZone: device });
  }, [device, lastSeenDeviceZone]);

  if (!device || device === profileZone || hidden) return null;
  if (dismissed && device === lastSeenDeviceZone) return null;

  function update() {
    startTransition(async () => {
      const result = await updatePreferencesAction({ timeZone: device });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t('today.timeZone.updated'));
      setHidden(true);
    });
  }

  function dismiss() {
    setHidden(true);
    void dismissTimeZoneHintAction();
  }

  return (
    <div
      role="status"
      data-testid="time-zone-hint"
      className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm"
    >
      <p className="min-w-0 flex-1 text-muted-foreground">
        {t('today.timeZone.changed', { device, profile: profileZone })}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0"
        onClick={update}
        disabled={pending}
      >
        {t('today.timeZone.update')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0"
        onClick={dismiss}
        aria-label={t('today.timeZone.dismiss')}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
