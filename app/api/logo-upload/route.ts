import { env } from '@/lib/server/platform';
import { ensureDatabase } from '@/db/runtime';
import { sanitizeImage } from '@/lib/images';
import { normalizeDestination } from '@/lib/listings';
import { getListingByKey } from '@/lib/server/board';
import { enforceRateLimit, HttpError, jsonError, verifyTurnstile } from '@/lib/server/security';

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'upload', 6, 60);
    const form = await request.formData();
    const destinationInput = String(form.get('destination') ?? '');
    const previewId = String(form.get('previewId') ?? '');
    const token = String(form.get('turnstileToken') ?? '') || undefined;
    await verifyTurnstile(token, request);
    if (!/^[0-9a-f-]{36}$/i.test(previewId)) throw new HttpError(400, 'Create a fresh listing preview before uploading a logo.');
    const destination = normalizeDestination(destinationInput);
    if (await getListingByKey(destination.normalizedKey)) throw new HttpError(409, 'This listing is already locked and cannot be edited.');
    await ensureDatabase();
    const preview = await env.DB.prepare(`SELECT id, normalized_key, expires_at FROM listing_previews WHERE id = ? LIMIT 1`).bind(previewId).first<{
      id: string;
      normalized_key: string;
      expires_at: number;
    }>();
    if (!preview || preview.normalized_key !== destination.normalizedKey || preview.expires_at <= Date.now()) {
      throw new HttpError(400, 'That preview expired. Create a fresh preview and try again.');
    }
    const file = form.get('file');
    if (!(file instanceof File)) throw new HttpError(400, 'Choose a PNG, JPEG, or WebP logo.');
    const image = sanitizeImage(await file.arrayBuffer());
    const key = `previews/${previewId}-custom.${image.extension}`;
    await env.FILES.put(key, image.bytes, {
      httpMetadata: { contentType: image.contentType, cacheControl: 'public, max-age=3600' },
      customMetadata: { source: 'custom', previewId },
    });
    await env.DB.prepare(`UPDATE listing_previews SET logo_key = ?, logo_content_type = ? WHERE id = ?`).bind(
      key, image.contentType, previewId,
    ).run();
    return Response.json({ logoUrl: `/assets/${key}` });
  } catch (error) {
    return jsonError(error);
  }
}
