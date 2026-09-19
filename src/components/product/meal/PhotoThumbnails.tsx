'use client';

import { useState } from 'react';
import { Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/UiComponents';
import type { StagedPhoto } from '@/components/product/meal/PhotoPicker';
import { t } from '@/lib/t';

/**
 * The staged photos at the top of "Check your meal" (O D4): 64 px squares
 * from the object URLs the composer holds; a tap opens the full image. A
 * photo restored without its preview (after a reload) shows a placeholder.
 */
export function PhotoThumbnails({ photos }: { photos: StagedPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (photos.length === 0) return null;
  const current = open === null ? null : (photos[open] ?? null);
  return (
    <>
      <ul className="flex flex-wrap gap-2" data-testid="review-photos">
        {photos.map((photo, index) => (
          <li key={photo.uploadId}>
            {photo.previewUrl ? (
              <button
                type="button"
                onClick={() => setOpen(index)}
                aria-label={t('meal.review.openPhoto', { index: index + 1 })}
                className="block overflow-hidden rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- object URL preview */}
                <img
                  src={photo.previewUrl}
                  alt={t('meal.compose.photoPreview', { index: index + 1 })}
                  className="size-16 object-cover"
                />
              </button>
            ) : (
              <div
                className="grid size-16 place-content-center rounded-md border border-border bg-muted text-muted-foreground"
                role="img"
                aria-label={t('meal.compose.photoPreview', { index: index + 1 })}
              >
                <Camera className="size-5" aria-hidden="true" />
              </div>
            )}
          </li>
        ))}
      </ul>
      <Dialog open={current !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-w-3xl p-2" data-testid="photo-dialog">
          <DialogTitle className="sr-only">
            {t('meal.compose.photoPreview', { index: (open ?? 0) + 1 })}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('meal.review.photoDialogHint')}
          </DialogDescription>
          {current?.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL preview
            <img
              src={current.previewUrl}
              alt={t('meal.compose.photoPreview', { index: (open ?? 0) + 1 })}
              className="max-h-[80vh] w-full rounded-md object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
