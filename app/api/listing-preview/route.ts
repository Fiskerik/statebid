import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { ensureDatabase } from '@/db/runtime';
import { assertNoProhibitedIndicators, normalizeDestination } from '@/lib/listings';
import { getListingByKey } from '@/lib/server/board';
import { cleanupExpiredPreviews } from '@/lib/server/cleanup';
import { cacheRemoteLogo, discoverMetadata } from '@/lib/server/metadata';
import { assertNotBlocked, enforceRateLimit, jsonError, verifyTurnstile } from '@/lib/server/security';
import type { ListingPreview } from '@/lib/types';

const schema = z.object({
  destination: z.string().min(1).max(2048),
  turnstileToken: z.string().max(4096).optional(),
});

export async function POST(request: Request) {
  try {
    await cleanupExpiredPreviews().catch(() => undefined);
    await enforceRateLimit(request, 'preview', 12, 60);
    const input = schema.parse(await request.json());
    await verifyTurnstile(input.turnstileToken, request);
    const destination = normalizeDestination(input.destination);
    await assertNotBlocked(destination.normalizedKey, new URL(destination.canonicalUrl).hostname);
    const existing = await getListingByKey(destination.normalizedKey);
    if (existing) {
      const response: ListingPreview = {
        existing: true,
        previewId: null,
        listing: {
          id: existing.id,
          normalizedKey: existing.normalized_key,
          destinationType: existing.destination_type,
          canonicalUrl: existing.canonical_url,
          title: existing.title,
          description: existing.description,
          logoUrl: existing.logo_key ? `/assets/${existing.logo_key}` : null,
        },
      };
      return Response.json(response);
    }

    const metadata = await discoverMetadata(destination).catch((error) => {
      if (destination.type !== 'x') throw error;
      return { title: destination.fallbackTitle, description: 'X profile', logoUrl: null };
    });
    assertNoProhibitedIndicators(`${metadata.title} ${metadata.description}`);
    const previewId = crypto.randomUUID();
    let logoKey: string | null = null;
    let logoContentType: string | null = null;
    if (metadata.logoUrl) {
      try {
        const logo = await cacheRemoteLogo(metadata.logoUrl, `previews/${previewId}-auto`);
        logoKey = logo.key;
        logoContentType = logo.contentType;
      } catch {
        // A safe text fallback is preferable to failing an otherwise valid preview.
      }
    }
    const now = Date.now();
    await ensureDatabase();
    await env.DB.prepare(`INSERT INTO listing_previews(
      id, normalized_key, destination_type, canonical_url, title, description,
      logo_key, logo_content_type, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      previewId,
      destination.normalizedKey,
      destination.type,
      destination.canonicalUrl,
      metadata.title,
      metadata.description,
      logoKey,
      logoContentType,
      now,
      now + 60 * 60 * 1000,
    ).run();
    const response: ListingPreview = {
      existing: false,
      previewId,
      listing: {
        id: previewId,
        normalizedKey: destination.normalizedKey,
        destinationType: destination.type,
        canonicalUrl: destination.canonicalUrl,
        title: metadata.title,
        description: metadata.description,
        logoUrl: logoKey ? `/assets/${logoKey}` : null,
      },
    };
    return Response.json(response);
  } catch (error) {
    return jsonError(error);
  }
}
