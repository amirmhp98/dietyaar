import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  APP_URL: 'http://localhost:3000',
  PHOTO_LOGGING_ENABLED: true,
  STORAGE_SOFT_LIMIT_BYTES: 734_003_200,
  S3_KEY_PREFIX: '',
}));
vi.mock('@/lib/env', () => ({ env: envMock, storageConfigured: true }));

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(async () => ({ id: 'u1', username: 'sara', role: 'USER' })),
}));

const sharpChain = vi.hoisted(() => ({
  rotate: vi.fn(),
  resize: vi.fn(),
  jpeg: vi.fn(),
  toBuffer: vi.fn(),
}));
vi.mock('sharp', () => ({ default: vi.fn(() => sharpChain) }));

const storage = vi.hoisted(() => ({ putObject: vi.fn(), deleteObject: vi.fn() }));
vi.mock('@/services/storage/s3', () => ({
  createStorage: vi.fn(() => storage),
  uploadKey: (userId: string, id: string) => `uploads/${userId}/${id}.jpg`,
}));

vi.mock('@/services/upload.service', () => ({
  stageUpload: vi.fn(),
  deleteStagedUpload: vi.fn(),
}));

import sharp from 'sharp';
import { ServiceError } from '@/lib/errors';
import { sniffImageType } from '@/lib/image-type';
import { resetRateLimits } from '@/services/rate-limit.service';
import { deleteStagedUpload, stageUpload } from '@/services/upload.service';
import { POST } from '@/app/api/uploads/route';
import { DELETE } from '@/app/api/uploads/[id]/route';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(20).fill(0)]);
const PNG = Uint8Array.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  ...new Array(20).fill(0),
]);
const WEBP = Uint8Array.from([
  ...Buffer.from('RIFF'),
  0,
  0,
  0,
  0,
  ...Buffer.from('WEBP'),
  ...Buffer.from('VP8 '),
  ...new Array(8).fill(0),
]);
const HEIC = Uint8Array.from([0, 0, 0, 0x18, ...Buffer.from('ftypheic'), ...new Array(12).fill(0)]);

function upload(bytes: Uint8Array, init: { origin?: string | null; size?: number } = {}) {
  const body = new FormData();
  const part = init.size ? new Uint8Array(init.size) : bytes;
  const blob = new Blob([part as unknown as ArrayBuffer], { type: 'image/jpeg' });
  body.set('file', blob, 'photo.jpg');
  const headers = new Headers();
  if (init.origin !== null) headers.set('origin', init.origin ?? 'http://localhost:3000');
  return new Request('http://localhost:3000/api/uploads', { method: 'POST', body, headers });
}

beforeEach(() => {
  resetRateLimits();
  envMock.PHOTO_LOGGING_ENABLED = true;
  vi.mocked(sharp).mockClear();
  sharpChain.rotate.mockReturnValue(sharpChain);
  sharpChain.resize.mockReturnValue(sharpChain);
  sharpChain.jpeg.mockReturnValue(sharpChain);
  sharpChain.toBuffer.mockResolvedValue({
    data: Buffer.from('encoded-jpeg'),
    info: { width: 1280, height: 960 },
  });
  storage.putObject.mockReset().mockResolvedValue(undefined);
  storage.deleteObject.mockReset().mockResolvedValue(undefined);
  vi.mocked(stageUpload)
    .mockReset()
    .mockImplementation(async (_owner, input) => ({
      id: input.id,
      width: input.width,
      height: input.height,
      expiresAt: new Date(),
    }));
});

describe('sniffImageType', () => {
  it('recognises JPEG, PNG, WebP and HEIC by magic bytes', () => {
    expect(sniffImageType(JPEG)).toBe('jpeg');
    expect(sniffImageType(PNG)).toBe('png');
    expect(sniffImageType(WEBP)).toBe('webp');
    expect(sniffImageType(HEIC)).toBe('heic');
    expect(sniffImageType(Uint8Array.from(Buffer.from('%PDF-1.4 hello world')))).toBe('unknown');
    expect(sniffImageType(new Uint8Array(2))).toBe('unknown');
  });
});

describe('POST /api/uploads', () => {
  it('re-encodes a JPEG, stores it and stages the row', async () => {
    const response = await POST(upload(JPEG));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ width: 1280, height: 960 });
    expect(body.uploadId).toMatch(/^[0-9a-f-]{36}$/);

    expect(sharp).toHaveBeenCalledWith(expect.any(Uint8Array), { limitInputPixels: 40e6 });
    expect(sharpChain.resize).toHaveBeenCalledWith({
      width: 1280,
      height: 1280,
      fit: 'inside',
      withoutEnlargement: true,
    });
    expect(sharpChain.jpeg).toHaveBeenCalledWith({ quality: 82 });
    expect(storage.putObject).toHaveBeenCalledWith(
      `uploads/u1/${body.uploadId}.jpg`,
      Buffer.from('encoded-jpeg'),
      { contentType: 'image/jpeg' },
    );
    expect(vi.mocked(stageUpload).mock.calls[0]?.[1]).toMatchObject({
      id: body.uploadId,
      bytes: 12,
      storageKey: `uploads/u1/${body.uploadId}.jpg`,
    });
  });

  it('accepts PNG and WebP', async () => {
    expect((await POST(upload(PNG))).status).toBe(201);
    expect((await POST(upload(WEBP))).status).toBe(201);
  });

  it('rejects HEIC and unknown bytes with 415 UPLOAD_TYPE', async () => {
    const heic = await POST(upload(HEIC));
    expect(heic.status).toBe(415);
    expect(await heic.json()).toMatchObject({ code: 'UPLOAD_TYPE', reason: 'heic' });
    const unknown = await POST(upload(Uint8Array.from(Buffer.from('GIF89a......'))));
    expect(unknown.status).toBe(415);
    expect(sharp).not.toHaveBeenCalled();
  });

  it('rejects a body over 10 MB with 413 UPLOAD_SIZE', async () => {
    const response = await POST(upload(JPEG, { size: 10 * 1024 * 1024 + 1 }));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'UPLOAD_SIZE' });
  });

  it('refuses a foreign or missing Origin with 403', async () => {
    expect((await POST(upload(JPEG, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await POST(upload(JPEG, { origin: null }))).status).toBe(403);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('answers 403 PHOTO_DISABLED when the flag is off', async () => {
    envMock.PHOTO_LOGGING_ENABLED = false;
    const response = await POST(upload(JPEG));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'PHOTO_DISABLED' });
  });

  it('rate-limits after 60 uploads in an hour', async () => {
    for (let i = 0; i < 60; i += 1) expect((await POST(upload(JPEG))).status).toBe(201);
    const response = await POST(upload(JPEG));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('removes the object again when the row is refused (STORAGE_FULL → 507)', async () => {
    vi.mocked(stageUpload).mockRejectedValue(new ServiceError('full', 'STORAGE_FULL'));
    const response = await POST(upload(JPEG));
    expect(response.status).toBe(507);
    expect(await response.json()).toMatchObject({ code: 'STORAGE_FULL' });
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
  });

  it('maps a decode failure to 415', async () => {
    sharpChain.toBuffer.mockRejectedValue(new Error('Input buffer contains unsupported image'));
    const response = await POST(upload(JPEG));
    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({ code: 'UPLOAD_TYPE', reason: 'decode' });
  });
});

describe('DELETE /api/uploads/[id]', () => {
  const request = (origin = 'http://localhost:3000') =>
    new Request('http://localhost:3000/api/uploads/up1', {
      method: 'DELETE',
      headers: { origin },
    });
  const params = Promise.resolve({ id: 'up1' });

  it('deletes the owner’s staged upload', async () => {
    vi.mocked(deleteStagedUpload).mockResolvedValue(undefined);
    expect((await DELETE(request(), { params })).status).toBe(204);
    expect(deleteStagedUpload).toHaveBeenCalledWith('u1', 'up1');
  });

  it('answers 404 for a missing or attached upload and 403 cross-origin', async () => {
    vi.mocked(deleteStagedUpload).mockRejectedValue(new ServiceError('nope', 'NOT_FOUND'));
    expect((await DELETE(request(), { params })).status).toBe(404);
    expect((await DELETE(request('https://evil.example'), { params })).status).toBe(403);
  });
});
