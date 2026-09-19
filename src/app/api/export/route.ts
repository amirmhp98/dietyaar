import { Readable } from 'node:stream';
import archiver from 'archiver';
import { requireApiAuth } from '@/lib/auth';
import { storageConfigured } from '@/lib/env';
import { logger } from '@/lib/logger';
import { localDateFor } from '@/lib/time';
import { recordEvent } from '@/services/analytics.service';
import { buildExport } from '@/services/export.service';
import { createStorage } from '@/services/storage/s3';

export const dynamic = 'force-dynamic';

/**
 * GET /api/export — `dietyaar-export-{date}.zip` streamed as it is built
 * (tech spec § 7). JSON documents first, then each retained photo; photo
 * bodies are opened lazily so only one object stream is live at a time.
 */
export async function GET(): Promise<Response> {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const now = new Date();
  const bundle = await buildExport(user.id, now);
  const date = bundle.timeZone
    ? localDateFor(now, bundle.timeZone)
    : now.toISOString().slice(0, 10);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('warning', (error) => logger.warn({ err: error, userId: user.id }, 'export warning'));
  archive.on('error', (error) => logger.error({ err: error, userId: user.id }, 'export failed'));

  const json = (value: unknown) => JSON.stringify(value, null, 2);
  archive.append(json({ exportedAt: bundle.exportedAt, ...bundle.profile }), {
    name: 'profile.json',
  });
  archive.append(json(bundle.plan), { name: 'plan.json' });
  archive.append(json(bundle.meals), { name: 'meals.json' });
  archive.append(json(bundle.messages), { name: 'messages.json' });

  const photos = storageConfigured ? bundle.photos : [];
  if (photos.length > 0) {
    const storage = createStorage('photos');
    for (const photo of photos) {
      archive.append(
        Readable.from(
          (async function* () {
            yield* await storage.getObjectStream(photo.storageKey);
          })(),
        ),
        { name: `photos/${photo.uploadId}.jpg` },
      );
    }
  }

  void archive.finalize();
  void recordEvent('export_downloaded', { photos: photos.length }, user.id);

  return new Response(Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="dietyaar-export-${date}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
