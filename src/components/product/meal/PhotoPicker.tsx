'use client';

import type { ChangeEvent, ReactNode } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';
import { buttonVariants, Spinner } from '@/components/UiComponents';
import { useCoarsePointer } from '@/components/product/meal/use-media-query';
import { PHOTOS_PER_MEAL } from '@/components/product/photo-input';
import { t } from '@/lib/t';
import { cn } from '@/lib/utils';

export interface StagedPhoto {
  uploadId: string;
  previewUrl: string;
  width: number;
  height: number;
}

/**
 * One file action: a `<label>` styled as an outline button that wraps a real
 * `<input type="file">`. The browser opens its own picker when the label is
 * tapped, so nothing depends on a programmatic `click()` (improvement plan
 * B9: that call is what went inert inside the sheet on phones). The input is
 * visually hidden but stays focusable, so keyboard users tab to it and the
 * label shows the ring.
 */
function FileAction({
  label,
  icon,
  accept,
  capture,
  multiple,
  disabled,
  testId,
  inputTestId,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  accept: string;
  capture?: 'environment';
  multiple?: boolean;
  disabled: boolean;
  testId: string;
  inputTestId: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      className={cn(
        buttonVariants({ variant: 'outline' }),
        'h-11 cursor-pointer has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-ring',
        disabled && 'pointer-events-none opacity-50',
      )}
      data-testid={testId}
    >
      {icon}
      {label}
      <input
        type="file"
        accept={accept}
        capture={capture}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        aria-label={label}
        data-testid={inputTestId}
        onChange={onChange}
      />
    </label>
  );
}

/**
 * Compose-step photo control (product spec § 7): 1–3 photos of the same
 * meal, preview thumbnails from object URLs, remove while staged. On a touch
 * device two actions: "Take photo" opens the camera (`capture`), "Choose
 * from gallery" the library (HEIC accepted, several at once). With a mouse
 * one "Add photo" lets the OS offer both. A denied camera still leaves the
 * gallery, text and the other paths.
 */
export function PhotoPicker({
  photos,
  busy,
  onAdd,
  onRemove,
}: {
  photos: StagedPhoto[];
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (uploadId: string) => void;
}) {
  const coarse = useCoarsePointer();
  const full = photos.length >= PHOTOS_PER_MEAL;
  const remaining = PHOTOS_PER_MEAL - photos.length;

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) onAdd(files.slice(0, remaining));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((photo, index) => (
          <div key={photo.uploadId} className="relative">
            {photo.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- object URL preview
              <img
                src={photo.previewUrl}
                alt={t('meal.compose.photoPreview', { index: index + 1 })}
                className="size-20 rounded-md border border-border object-cover"
              />
            ) : (
              <div
                className="grid size-20 place-content-center rounded-md border border-border bg-muted text-muted-foreground"
                aria-label={t('meal.compose.photoPreview', { index: index + 1 })}
                role="img"
              >
                <Camera className="size-6" aria-hidden="true" />
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(photo.uploadId)}
              aria-label={t('meal.compose.removePhoto', { index: index + 1 })}
              className="absolute -end-2 -top-2 grid size-7 place-content-center rounded-full border border-border bg-background text-foreground shadow"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        {busy ? (
          <div className="grid size-20 place-content-center rounded-md border border-dashed border-border">
            <Spinner />
          </div>
        ) : null}
        {!full && coarse ? (
          <FileAction
            label={t('meal.compose.photoTake')}
            icon={<Camera aria-hidden="true" />}
            accept="image/*"
            capture="environment"
            disabled={busy}
            testId="take-photo"
            inputTestId="photo-input-camera"
            onChange={handleFiles}
          />
        ) : null}
        {!full ? (
          <FileAction
            label={coarse ? t('meal.compose.photoGallery') : t('meal.compose.addPhoto')}
            icon={coarse ? <ImageIcon aria-hidden="true" /> : <Camera aria-hidden="true" />}
            accept="image/*,.heic,.heif"
            multiple
            disabled={busy}
            testId="add-photo"
            inputTestId="photo-input"
            onChange={handleFiles}
          />
        ) : null}
      </div>
      {photos.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('meal.compose.photosMax', { max: PHOTOS_PER_MEAL })}
        </p>
      ) : null}
    </div>
  );
}
