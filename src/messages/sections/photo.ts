/** Strings owned by the photos and export module. Keys are flat and globally unique; add them here, not in en.ts. */
export const photo = {
  'photo.errors.storageUnavailable': "Photo storage isn't available right now. Try again later.",
  'photo.errors.disabled': 'Photo logging is turned off in this release.',
  'photo.errors.type': 'Use a JPEG, PNG, WebP or HEIC photo.',
  'photo.errors.size': 'Photos must be under 10 MB.',
  'photo.errors.storageFull':
    'Photo storage is full right now. You can still describe the meal in words.',
  'photo.errors.rateLimited': 'Too many photos in the last hour. Try again later.',
  'photo.errors.notFound': "That photo isn't available.",
  'photo.errors.unsupported': "We couldn't read that image. Try a different photo.",
  'photo.errors.network': "The photo couldn't be uploaded. Check your connection and try again.",
  'photo.errors.origin': 'This request did not come from the app.',
} as const;
