'use client';

import { useRef } from 'react';
import { Camera, X } from 'lucide-react';
import { Button, Spinner } from '@/components/UiComponents';
import { PHOTOS_PER_MEAL } from '@/components/product/photo-input';
import { t } from '@/lib/t';

export interface StagedPhoto {
  uploadId: string;
  previewUrl: string;
  width: number;
  height: number;
}

/**
 * Compose-step photo control (product spec § 7): 1–3 photos of the same
 * meal, preview thumbnails from object URLs, remove while staged. A plain
 * file input lets the browser offer camera or library; a denied camera
 * still leaves the library, text and the other paths.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const full = photos.length >= PHOTOS_PER_MEAL;
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
        {!full ? (
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            data-testid="add-photo"
          >
            <Camera className="size-4" aria-hidden="true" />
            {t('meal.compose.addPhoto')}
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="photo-input"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) onAdd(files.slice(0, PHOTOS_PER_MEAL - photos.length));
        }}
      />
      {photos.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('meal.compose.photosMax', { max: PHOTOS_PER_MEAL })}
        </p>
      ) : null}
    </div>
  );
}
