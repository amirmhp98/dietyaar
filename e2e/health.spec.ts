import { expect, test } from '@playwright/test';

test('GET /api/health answers without a session cookie', async ({ request }) => {
  const response = await request.get('/api/health', { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe('healthy');
  expect(body.checks.database).toBe('ok');
});

test('security headers are present', async ({ request }) => {
  const response = await request.get('/login');
  const headers = response.headers();
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
});
