import { Readable } from 'node:stream';
import { cookies } from 'next/headers';
import { requireApiAuth } from '@/lib/auth';
import { ServiceError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { photoTag } from '@/lib/photo-url';
import { SESSION_COOKIE } from '@/lib/session-cookie';
import { createStorage } from '@/services/storage/s3';
import { getUploadForView } from '@/services/upload.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/photos/[id]?s=<tag> — streams the owner's photo (tech spec § 7).
 * The tag binds the URL to the session so a browser cache entry never crosses
 * accounts (TS-§21.16); a foreign id, a missing object and a wrong tag all
 * answer 404 alike.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const { id } = await params;
  const tag = new URL(request.url).searchParams.get('s');
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!tag || !token || photoTag(token) !== tag) return notFound();

  const upload = await getUploadForView(user.id, id);
  if (!upload) return notFound();

  try {
    const stream = await createStorage('photos').getObjectStream(upload.storageKey);
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(upload.bytes),
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'NOT_FOUND') return notFound();
    logger.error({ err: error, userId: user.id, uploadId: id }, 'photo stream failed');
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

function notFound(): Response {
  return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}
