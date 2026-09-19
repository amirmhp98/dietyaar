/**
 * Device-side photo pipeline (tech spec § 11 step 1, decision 011). Plain TS,
 * browser only: the composer island calls these and renders the result.
 *
 *   prepareImage(file)   HEIC/HEIF → JPEG via `heic-to`, then a canvas
 *                        downscale to a 1280 px max edge at JPEG 0.8, so the
 *                        upload stays well under 1 MB and location metadata
 *                        never leaves the phone.
 *   uploadImage(blob)    POST /api/uploads → { uploadId, width, height }.
 *   deleteStagedImage()  DELETE /api/uploads/[id] while the photo is staged.
 */

export const PHOTO_MAX_EDGE = 1280;
export const PHOTO_JPEG_QUALITY = 0.8;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTOS_PER_MEAL = 3;

export type PhotoErrorCode =
  | 'PHOTO_DISABLED'
  | 'UPLOAD_TYPE'
  | 'UPLOAD_SIZE'
  | 'STORAGE_FULL'
  | 'STORAGE_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'UNSUPPORTED'
  | 'NETWORK'
  | 'UNEXPECTED';

export class PhotoUploadError extends Error {
  constructor(
    readonly code: PhotoErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'PhotoUploadError';
  }
}

export interface UploadedPhoto {
  uploadId: string;
  width: number;
  height: number;
}

const HEIC_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const RASTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isHeicFile(file: File): boolean {
  if (HEIC_TYPES.has(file.type.toLowerCase())) return true;
  // iOS sometimes reports an empty type; fall back to the extension.
  return file.type === '' && /\.(heic|heif)$/i.test(file.name);
}

export function isAcceptedFile(file: File): boolean {
  return RASTER_TYPES.has(file.type.toLowerCase()) || isHeicFile(file);
}

async function toJpegSource(file: File): Promise<Blob> {
  if (!isHeicFile(file)) return file;
  try {
    const { heicTo } = await import('heic-to');
    return await heicTo({ blob: file, type: 'image/jpeg', quality: PHOTO_JPEG_QUALITY });
  } catch {
    throw new PhotoUploadError('UNSUPPORTED');
  }
}

async function encodeCanvas(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: PHOTO_JPEG_QUALITY });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', PHOTO_JPEG_QUALITY),
  );
}

/**
 * Converts and downscales on the device. When the browser cannot decode the
 * image (old WebView, exotic PNG) the original JPEG/PNG/WebP is returned as
 * is and the server re-encodes it; HEIC that failed to convert is refused.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (!isAcceptedFile(file)) throw new PhotoUploadError('UPLOAD_TYPE');
  if (file.size > PHOTO_MAX_BYTES) throw new PhotoUploadError('UPLOAD_SIZE');
  const source = await toJpegSource(file);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  } catch {
    return source;
  }
  try {
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const encoded = await encodeCanvas(bitmap, width, height);
    return encoded ?? source;
  } finally {
    bitmap.close();
  }
}

async function errorFromResponse(response: Response): Promise<PhotoUploadError> {
  let code: string | undefined;
  let message: string | undefined;
  try {
    const body = (await response.json()) as { code?: string; error?: string };
    code = body.code;
    message = body.error;
  } catch {
    // Non-JSON body (proxy error page): fall through to the status mapping.
  }
  const known: PhotoErrorCode[] = [
    'PHOTO_DISABLED',
    'UPLOAD_TYPE',
    'UPLOAD_SIZE',
    'STORAGE_FULL',
    'STORAGE_UNAVAILABLE',
    'RATE_LIMITED',
    'FORBIDDEN',
    'NOT_FOUND',
  ];
  if (code && (known as string[]).includes(code)) {
    return new PhotoUploadError(code as PhotoErrorCode, message);
  }
  if (response.status === 401) return new PhotoUploadError('UNAUTHENTICATED', message);
  if (response.status === 413) return new PhotoUploadError('UPLOAD_SIZE', message);
  if (response.status === 415) return new PhotoUploadError('UPLOAD_TYPE', message);
  if (response.status === 404) return new PhotoUploadError('NOT_FOUND', message);
  return new PhotoUploadError('UNEXPECTED', message);
}

/** Uploads one prepared image; the result's `uploadId` goes into the draft's `uploadIds`. */
export async function uploadImage(blob: Blob): Promise<UploadedPhoto> {
  const body = new FormData();
  body.set('file', blob, 'photo.jpg');
  let response: Response;
  try {
    response = await fetch('/api/uploads', { method: 'POST', body, credentials: 'same-origin' });
  } catch {
    throw new PhotoUploadError('NETWORK');
  }
  if (!response.ok) throw await errorFromResponse(response);
  const data = (await response.json()) as Partial<UploadedPhoto>;
  if (!data.uploadId || typeof data.width !== 'number' || typeof data.height !== 'number') {
    throw new PhotoUploadError('UNEXPECTED');
  }
  return { uploadId: data.uploadId, width: data.width, height: data.height };
}

/** Removes a staged photo (composer "remove" before save). Already gone counts as done. */
export async function deleteStagedImage(uploadId: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/uploads/${encodeURIComponent(uploadId)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
  } catch {
    throw new PhotoUploadError('NETWORK');
  }
  if (response.ok || response.status === 404) return;
  throw await errorFromResponse(response);
}
