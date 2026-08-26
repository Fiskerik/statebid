import { ensureDatabase } from '@/db/runtime';
import { env, isDatabaseConfigured } from '@/lib/server/platform';
import { hashValue, HttpError } from '@/lib/server/security';

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return Response.json({ visitors: 0 });
  await ensureDatabase();
  const existing = readCookie(request.headers.get('cookie'), 'sb_vid');
  const visitorId = existing ?? crypto.randomUUID();
  if (!/^[0-9a-f-]{36}$/i.test(visitorId)) throw new HttpError(400, 'Invalid visitor identifier.');
  const visitorHash = await hashValue(`${env.RATE_LIMIT_SALT ?? 'statebid-local'}:site-visitor:${visitorId}`);
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO site_visitors(visitor_hash, first_seen_at, last_seen_at)
    VALUES (?, ?, ?)
    ON CONFLICT(visitor_hash) DO UPDATE SET last_seen_at = excluded.last_seen_at`).bind(visitorHash, now, now).run();
  const row = await env.DB.prepare('SELECT COUNT(*) AS visitors FROM site_visitors').first<{ visitors: number | string }>();
  const headers = new Headers({ 'cache-control': 'no-store' });
  if (!existing) headers.set('set-cookie', `sb_vid=${visitorId}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`);
  return Response.json({ visitors: Number(row?.visitors ?? 0) }, { headers });
}

function readCookie(header: string | null, name: string) {
  const match = header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
