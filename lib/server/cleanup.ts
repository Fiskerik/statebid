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

export async function maybeCleanupOperationalData(now = Date.now()) {
  await ensureDatabase();
  const key = 'maintenance:operational-cleanup';
  const marker = await env.DB.prepare('SELECT reset_at FROM rate_limits WHERE key = ? LIMIT 1').bind(key).first<{ reset_at: number }>();
  if (marker && marker.reset_at > now) return;
  await env.DB.prepare(`INSERT INTO rate_limits(key, count, reset_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count = count + 1, reset_at = excluded.reset_at`)
    .bind(key, now + 60 * 60 * 1000).run();
  await cleanupExpiredPreviews(now, 100);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM click_events WHERE created_at < ?').bind(now - 30 * 24 * 60 * 60 * 1000),
    env.DB.prepare(`DELETE FROM bid_attempts WHERE status != 'paid' AND created_at < ?`).bind(now - 30 * 24 * 60 * 60 * 1000),
    env.DB.prepare('DELETE FROM rate_limits WHERE reset_at < ? AND key != ?').bind(now - 24 * 60 * 60 * 1000, key),
  ]);
}
