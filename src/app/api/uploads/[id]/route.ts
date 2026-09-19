import { requireApiAuth } from '@/lib/auth';
import { ServiceError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { assertSameOrigin } from '@/lib/request-origin';
import { deleteStagedUpload } from '@/services/upload.service';

export const dynamic = 'force-dynamic';

/** DELETE /api/uploads/[id] — the composer's "remove" while a photo is still staged. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;

  const { id } = await params;
  try {
    await deleteStagedUpload(user.id, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 503;
      return Response.json({ code: error.code, error: error.message }, { status });
    }
    logger.error({ err: error, userId: user.id, uploadId: id }, 'staged upload delete failed');
    return Response.json({ code: 'UNEXPECTED' }, { status: 500 });
  }
}
