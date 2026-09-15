import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fail, fromError, fromZodError, ok } from '@/lib/action-result';
import { ServiceError } from '@/lib/errors';

describe('ActionResult helpers', () => {
  it('ok() wraps data and supports void', () => {
    expect(ok()).toEqual({ ok: true, data: undefined });
    expect(ok({ id: 1 })).toEqual({ ok: true, data: { id: 1 } });
  });

  it('fail() carries the message and optional field errors', () => {
    expect(fail('x')).toEqual({ ok: false, error: 'x' });
    expect(fail('x', { name: ['bad'] })).toEqual({
      ok: false,
      error: 'x',
      fieldErrors: { name: ['bad'] },
    });
  });

  it('fromZodError groups issues per field and uses the first as the summary', () => {
    const schema = z.object({
      name: z.string().min(2, 'کوتاه'),
      age: z.number({ message: 'عدد' }),
    });
    const parsed = schema.safeParse({ name: 'a', age: 'x' });
    if (parsed.success) throw new Error('expected failure');

    const result = fromZodError(parsed.error);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('کوتاه');
    expect(result.fieldErrors).toEqual({ name: ['کوتاه'], age: ['عدد'] });
  });

  it('fromError exposes ServiceError messages but hides everything else', () => {
    expect(fromError(new ServiceError('پیام', 'CODE'))).toEqual({ ok: false, error: 'پیام' });
    const generic = fromError(new Error('ECONNREFUSED'));
    expect(generic.ok).toBe(false);
    if (!generic.ok) expect(generic.error).not.toContain('ECONNREFUSED');
  });
});
