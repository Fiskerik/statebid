import { env } from 'cloudflare:workers';
import { ensureDatabase } from '@/db/runtime';
import { getStateWinner } from '@/lib/server/board';
import { hashValue } from '@/lib/server/security';
import { STATE_BY_CODE, type StateCode } from '@/lib/states';

export async function GET(request: Request, context: { params: Promise<{ stateCode: string }> }) {
  const { stateCode: rawCode } = await context.params;
  const stateCode = rawCode.toUpperCase() as StateCode;
  if (!STATE_BY_CODE.has(stateCode)) return new Response('State not found.', { status: 404 });
  const winner = await getStateWinner(stateCode);
  if (!winner) return new Response('This state is currently unclaimed.', { status: 404 });

  const cookie = request.headers.get('cookie') ?? '';
  const existingVisitor = cookie.match(/(?:^|;\s*)sb_vid=([a-f0-9-]{36})/i)?.[1];
  const visitorId = existingVisitor ?? crypto.randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  const visitorHash = await hashValue(`${env.RATE_LIMIT_SALT ?? 'statebid-local'}:${visitorId}:${winner.listing.id}:${stateCode}:${day}`);
  await ensureDatabase();
  const click = await env.DB.prepare(`INSERT OR IGNORE INTO click_events(
      id, listing_id, state_code, visitor_hash, day, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), winner.listing.id, stateCode, visitorHash, day, Date.now()).run()
    .catch((error) => console.warn('StateBid click count failed', { stateCode, error }));
  if (click && click.meta.changes > 0) {
    await env.DB.prepare(`INSERT INTO click_daily(listing_id, state_code, day, count)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(listing_id, state_code, day) DO UPDATE SET count = count + 1`)
      .bind(winner.listing.id, stateCode, day).run()
      .catch((error) => console.warn('StateBid click aggregate failed', { stateCode, error }));
  }

  const headers = new Headers({
    location: winner.listing.canonicalUrl,
    'cache-control': 'private, no-store',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-robots-tag': 'noindex',
  });
  if (!existingVisitor) headers.append('set-cookie', `sb_vid=${visitorId}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`);
  return new Response(null, { status: 302, headers });
}
