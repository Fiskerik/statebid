import { env } from 'cloudflare:workers';
import { ensureDatabase } from '@/db/runtime';
import { requireAdminApi } from '@/lib/server/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ('response' in auth) return auth.response;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const listingId = String(form.get('listingId') ?? '');
  const reason = String(form.get('reason') ?? '').slice(0, 500) || 'Operator review';
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) return Response.json({ error: 'Invalid listing.' }, { status: 400 });
  await ensureDatabase();
  const listing = await env.DB.prepare('SELECT id, normalized_key FROM listings WHERE id = ? LIMIT 1')
    .bind(listingId).first<{ id: string; normalized_key: string }>();
  if (!listing) return Response.json({ error: 'Listing not found.' }, { status: 404 });

  if (action === 'suspend' || action === 'reactivate') {
    const status = action === 'suspend' ? 'suspended' : 'active';
    await env.DB.batch([
      env.DB.prepare('UPDATE listings SET status = ? WHERE id = ?').bind(status, listingId),
      env.DB.prepare(`INSERT INTO moderation_events(id, listing_id, admin_user_id, action, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), listingId, auth.user.userId, action, reason, Date.now()),
    ]);
  } else if (action === 'block') {
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO blocklist(id, kind, value, reason, created_at)
        VALUES (?, 'destination', ?, ?, ?)`)
        .bind(crypto.randomUUID(), listing.normalized_key, reason, Date.now()),
      env.DB.prepare(`UPDATE listings SET status = 'suspended' WHERE id = ?`).bind(listingId),
      env.DB.prepare(`INSERT INTO moderation_events(id, listing_id, admin_user_id, action, reason, created_at)
        VALUES (?, ?, ?, 'block', ?, ?)`)
        .bind(crypto.randomUUID(), listingId, auth.user.userId, reason, Date.now()),
    ]);
  } else if (action === 'resolve-report') {
    const reportId = String(form.get('reportId') ?? '');
    await env.DB.prepare(`UPDATE content_reports SET status = 'resolved', resolved_at = ? WHERE id = ? AND listing_id = ?`)
      .bind(Date.now(), reportId, listingId).run();
  } else {
    return Response.json({ error: 'Unknown moderation action.' }, { status: 400 });
  }
  return Response.redirect(new URL('/admin', request.url), 303);
}
