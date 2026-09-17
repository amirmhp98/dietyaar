import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/upload.service', () => ({
  expireStagedUploads: vi.fn(),
  deleteUploadsForDrafts: vi.fn(),
}));
vi.mock('@/services/meal.service', () => ({ expireDrafts: vi.fn() }));

import { expireDrafts } from '@/services/meal.service';
import { deleteUploadsForDrafts, expireStagedUploads } from '@/services/upload.service';
import { runCleanup } from '@/services/jobs/cleanup.job';
import { taskByName } from '@/services/jobs/registry';

const now = new Date('2026-09-17T10:00:00Z');

beforeEach(() => {
  vi.mocked(expireStagedUploads).mockReset();
  vi.mocked(deleteUploadsForDrafts).mockReset().mockResolvedValue(0);
  vi.mocked(expireDrafts).mockReset().mockResolvedValue({ deleted: 0, uploadIds: [] });
});

describe('cleanup task', () => {
  it('registers hourly', () => {
    expect(taskByName('cleanup')).toMatchObject({ everyMs: 60 * 60 * 1000 });
  });

  it('drains staged uploads in batches of 50, then expired drafts with their uploads', async () => {
    vi.mocked(expireStagedUploads).mockResolvedValueOnce(50).mockResolvedValueOnce(3);
    vi.mocked(expireDrafts).mockResolvedValue({ deleted: 2, uploadIds: ['a', 'b'] });
    await runCleanup({ now, shouldStop: () => false });
    expect(expireStagedUploads).toHaveBeenCalledTimes(2);
    expect(expireStagedUploads).toHaveBeenCalledWith(now, 50);
    expect(expireDrafts).toHaveBeenCalledWith(now);
    expect(deleteUploadsForDrafts).toHaveBeenCalledWith(['a', 'b']);
  });

  it('stops at the checkpoint between batches', async () => {
    vi.mocked(expireStagedUploads).mockResolvedValue(50);
    let calls = 0;
    await runCleanup({ now, shouldStop: () => calls++ > 0 });
    expect(expireStagedUploads).toHaveBeenCalledTimes(1);
    expect(expireDrafts).not.toHaveBeenCalled();
  });
});
