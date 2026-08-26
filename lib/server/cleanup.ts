import { env } from 'cloudflare:workers';
import { ensureDatabase } from '@/db/runtime';

export async function cleanupExpiredPreviews(now = Date.now(), limit = 20) {
  await ensureDatabase();
  const rows = await env.DB.prepare(`SELECT p.id, p.logo_key FROM listing_previews p
    WHERE p.expires_at < ?
      AND NOT EXISTS (SELECT 1 FROM bid_attempts a
        WHERE a.provisional_logo_key = p.logo_key
          AND a.status = 'pending' AND a.expires_at > ?)
      AND NOT EXISTS (SELECT 1 FROM listings l WHERE l.logo_key = p.logo_key)
    LIMIT ?`).bind(now, now - 24 * 60 * 60 * 1000, limit).all<{ id: string; logo_key: string | null }>();
  for (const row of rows.results) {
    if (row.logo_key) await env.FILES.delete(row.logo_key);
    await env.DB.prepare('DELETE FROM listing_previews WHERE id = ?').bind(row.id).run();
  }
}
