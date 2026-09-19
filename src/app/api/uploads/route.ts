import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { requireApiAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { ServiceError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { UPLOAD_MAX_BYTES, sniffImageType } from '@/lib/image-type';
import { assertSameOrigin } from '@/lib/request-origin';
import { photo } from '@/messages/sections/photo';
import { isRateLimited } from '@/services/rate-limit.service';
import { createStorage, uploadKey } from '@/services/storage/s3';
import { stageUpload } from '@/services/upload.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/uploads — multipart `file` → staged JPEG (tech spec § 7, § 11).
 * A route handler rather than a server action because actions cap bodies at
 * 2 MB (decision 011). The device pipeline already downscaled the image; the
 * server sniffs the real type, re-encodes with sharp (metadata stripped),
 * stores the object and records the `Upload` row.
 */

const UPLOADS_PER_HOUR = 60;
const HOUR_MS = 60 * 60 * 1000;
const MAX_EDGE = 1280;
const JPEG_QUALITY = 82;
const MAX_INPUT_PIXELS = 40e6;

// Pending `t()` migration: the photo section is not wired into en.ts yet.
const msg = (key: keyof typeof photo) => photo[key];

function json(status: number, code: string, error: string): Response {
  return Response.json({ code, error }, { status });
}

// ─── Decode semaphore: at most two sharp decodes per process ────────────
const DECODE_SLOTS = 2;
let active = 0;
const waiting: Array<() => void> = [];

async function withDecodeSlot<T>(work: () => Promise<T>): Promise<T> {
  if (active >= DECODE_SLOTS) await new Promise<void>((resolve) => waiting.push(resolve));
  active += 1;
  try {
    return await work();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  if (!env.PHOTO_LOGGING_ENABLED) return json(403, 'PHOTO_DISABLED', msg('photo.errors.disabled'));
  if (isRateLimited(`upload:${user.id}`, UPLOADS_PER_HOUR, HOUR_MS)) {
    return json(429, 'RATE_LIMITED', msg('photo.errors.rateLimited'));
  }

  // Refuse oversized bodies before reading them; the exact check follows on the part.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > UPLOAD_MAX_BYTES + 64 * 1024) {
    return json(413, 'UPLOAD_SIZE', msg('photo.errors.size'));
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const part = form.get('file');
    if (part instanceof File) file = part;
  } catch {
    return json(400, 'BAD_REQUEST', msg('photo.errors.unsupported'));
  }
  if (!file) return json(400, 'BAD_REQUEST', msg('photo.errors.type'));
  if (file.size > UPLOAD_MAX_BYTES) return json(413, 'UPLOAD_SIZE', msg('photo.errors.size'));

  const input = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImageType(input);
  if (kind === 'heic' || kind === 'unknown') {
    return Response.json(
      { code: 'UPLOAD_TYPE', error: msg('photo.errors.type'), reason: kind },
      { status: 415 },
    );
  }

  let encoded: { data: Buffer; width: number; height: number };
  try {
    encoded = await withDecodeSlot(async () => {
      const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer({ resolveWithObject: true });
      return { data, width: info.width, height: info.height };
    });
  } catch (error) {
    logger.warn({ err: error, userId: user.id }, 'upload decode failed');
    return Response.json(
      { code: 'UPLOAD_TYPE', error: msg('photo.errors.unsupported'), reason: 'decode' },
      { status: 415 },
    );
  }

  const uploadId = randomUUID();
  const storageKey = uploadKey(user.id, uploadId);
  try {
    const storage = createStorage('photos');
    await storage.putObject(storageKey, encoded.data, { contentType: 'image/jpeg' });
    try {
      const staged = await stageUpload(
        user.id,
        {
          id: uploadId,
          bytes: encoded.data.byteLength,
          width: encoded.width,
          height: encoded.height,
          sha256: createHash('sha256').update(encoded.data).digest('hex'),
          storageKey,
        },
        new Date(),
      );
      return Response.json(
        { uploadId: staged.id, width: staged.width, height: staged.height },
        { status: 201 },
      );
    } catch (error) {
      // The row was refused (quota) or failed; do not leave an orphan object behind.
      await storage.deleteObject(storageKey).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = error.code === 'STORAGE_FULL' ? 507 : 503;
      return json(status, error.code, error.message);
    }
    logger.error({ err: error, userId: user.id }, 'upload failed');
    return json(500, 'UNEXPECTED', msg('photo.errors.network'));
  }
}
