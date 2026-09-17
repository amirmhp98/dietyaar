import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/live/route';

describe('GET /api/live', () => {
  it('answers 200 { ok: true } without touching anything', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
