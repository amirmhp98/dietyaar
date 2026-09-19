import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookies } from 'next/headers';

vi.mock('@/lib/auth', () => ({
  requireApiAuth: vi.fn(async () => ({
    ok: true,
    user: { id: 'u1', username: 'sara', role: 'USER' },
  })),
}));
vi.mock('@/services/upload.service', () => ({ getUploadForView: vi.fn() }));
const storage = vi.hoisted(() => ({ getObjectStream: vi.fn() }));
vi.mock('@/services/storage/s3', () => ({ createStorage: vi.fn(() => storage) }));

import { requireApiAuth } from '@/lib/auth';
import { ServiceError } from '@/lib/errors';
import { photoTag, photoUrl } from '@/lib/photo-url';
import { hashSessionToken } from '@/services/auth.service';
import { getUploadForView } from '@/services/upload.service';
import { GET } from '@/app/api/photos/[id]/route';

const TOKEN = 'raw-session-token';
const params = Promise.resolve({ id: 'up1' });
const request = (tag: string | null) =>
  new Request(`http://localhost:3000/api/photos/up1${tag === null ? '' : `?s=${tag}`}`);

beforeEach(() => {
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn((name: string) => (name === 'session' ? { value: TOKEN } : undefined)),
  } as never);
  vi.mocked(getUploadForView).mockReset().mockResolvedValue({
    id: 'up1',
    storageKey: 'uploads/u1/up1.jpg',
    bytes: 4,
    width: 10,
    height: 10,
    status: 'ATTACHED',
    mealId: 'm1',
  });
  storage.getObjectStream.mockReset().mockResolvedValue(Readable.from([Buffer.from('jpeg')]));
});

describe('photoUrl', () => {
  it('tags the URL with the first 12 hex chars of the token’s SHA-256', () => {
    expect(photoTag(TOKEN)).toBe(hashSessionToken(TOKEN).slice(0, 12));
    expect(photoUrl('up1', TOKEN)).toBe(`/api/photos/up1?s=${photoTag(TOKEN)}`);
  });
});

describe('GET /api/photos/[id]', () => {
  it('streams the owner’s photo privately cached for a day', async () => {
    const response = await GET(request(photoTag(TOKEN)), { params });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toBe('private, max-age=86400');
    expect(response.headers.get('content-length')).toBe('4');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('jpeg');
    expect(getUploadForView).toHaveBeenCalledWith('u1', 'up1');
  });

  it('answers 401 without touching storage when the session is gone', async () => {
    vi.mocked(requireApiAuth).mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 }),
    });
    expect((await GET(request(photoTag(TOKEN)), { params })).status).toBe(401);
    expect(getUploadForView).not.toHaveBeenCalled();
  });

  it('answers 404 for a wrong or missing tag without touching storage (TS-§21.16)', async () => {
    expect((await GET(request(photoTag('other-session')), { params })).status).toBe(404);
    expect((await GET(request(null), { params })).status).toBe(404);
    expect(getUploadForView).not.toHaveBeenCalled();
    expect(storage.getObjectStream).not.toHaveBeenCalled();
  });

  it('answers 404 for another account’s upload', async () => {
    vi.mocked(getUploadForView).mockResolvedValue(null);
    const response = await GET(request(photoTag(TOKEN)), { params });
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(storage.getObjectStream).not.toHaveBeenCalled();
  });

  it('answers 404 when the object is gone', async () => {
    storage.getObjectStream.mockRejectedValue(new ServiceError('gone', 'NOT_FOUND'));
    expect((await GET(request(photoTag(TOKEN)), { params })).status).toBe(404);
  });
});
