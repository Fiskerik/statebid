import { env, isDatabaseConfigured } from '@/lib/server/platform';
import { ensureDatabase } from '@/db/runtime';
import { requireAdminApi } from '@/lib/server/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ('response' in auth) return auth.response;
  if (!isDatabaseConfigured()) return Response.json({ error: 'Database setup required.' }, { status: 503 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const listingId = String(form.get('listingId') ?? '');
  const reason = String(form.get('reason') ?? '').slice(0, 500) || 'Operator review';
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) return Response.json({ error: 'Invalid listing.' }, { status: 400 });
  await ensureDatabase();
  const listing = await env.DB.prepare('SELECT id, normalized_key, logo_key FROM listings WHERE id = ? LIMIT 1')
    .bind(listingId).first<{ id: string; normalized_key: string; logo_key: string | null }>();
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
  } else if (action === 'edit') {
    const title = String(form.get('title') ?? '').trim().slice(0, 120);
    const description = String(form.get('description') ?? '').trim().slice(0, 280);
    const removeLogo = form.get('removeLogo') === 'on';
    if (!title) return Response.json({ error: 'A public title is required.' }, { status: 400 });
    await env.DB.batch([
      env.DB.prepare(`UPDATE listings SET title = ?, description = ?,
          logo_key = CASE WHEN ? = 1 THEN NULL ELSE logo_key END,
          logo_content_type = CASE WHEN ? = 1 THEN NULL ELSE logo_content_type END
        WHERE id = ?`).bind(title, description, removeLogo ? 1 : 0, removeLogo ? 1 : 0, listingId),
      env.DB.prepare(`INSERT INTO moderation_events(id, listing_id, admin_user_id, action, reason, created_at)
        VALUES (?, ?, ?, 'edit', ?, ?)`)
        .bind(crypto.randomUUID(), listingId, auth.user.userId, removeLogo ? 'Operator edited copy and removed logo' : 'Operator edited public copy', Date.now()),
    ]);
    if (removeLogo && listing.logo_key) await env.FILES.delete(listing.logo_key).catch(() => undefined);
  } else {
    return Response.json({ error: 'Unknown moderation action.' }, { status: 400 });
  }
  return Response.redirect(new URL('/admin', request.url), 303);
}
