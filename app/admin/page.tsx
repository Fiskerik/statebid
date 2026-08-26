import { env, isDatabaseConfigured } from '@/lib/server/platform';
import Link from 'next/link';
import { ensureDatabase } from '@/db/runtime';
import { requireAdminPage } from '@/lib/server/admin';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await requireAdminPage('/admin');
  if (!isDatabaseConfigured()) {
    return <main className="legal-shell admin-shell"><header className="legal-header"><Link className="wordmark" href="/"><span className="wordmark-icon"><span /></span><span>statebid</span><strong>.lol</strong></Link><div className="admin-identity"><span>{user.displayName}</span><form action="/api/admin/logout" method="post"><button type="submit">Sign out</button></form></div></header><section className="legal-hero"><span className="eyebrow"><span /> Operator only</span><h1>Database setup required.</h1><p>Connect Turso in Vercel and redeploy before using payments, reports, or moderation.</p></section></main>;
  }
  await ensureDatabase();
  const [listings, payments, reports, webhooks] = await Promise.all([
    env.DB.prepare(`SELECT l.id, l.title, l.normalized_key, l.status, l.created_at,
        CAST(COALESCE(SUM(p.amount_cents - p.reversed_cents), 0) AS TEXT) AS total_cents
      FROM listings l LEFT JOIN bid_payments p ON p.listing_id = l.id
      GROUP BY l.id ORDER BY l.created_at DESC LIMIT 100`).all<{
        id: string; title: string; normalized_key: string; status: string; created_at: number; total_cents: string;
      }>(),
    env.DB.prepare(`SELECT p.id, p.stripe_session_id, p.stripe_payment_intent_id, p.state_code,
        p.amount_cents, p.reversed_cents, p.paid_at, l.title
      FROM bid_payments p JOIN listings l ON l.id = p.listing_id
      ORDER BY p.paid_at DESC LIMIT 100`).all<{
        id: string; stripe_session_id: string; stripe_payment_intent_id: string | null; state_code: string;
        amount_cents: number; reversed_cents: number; paid_at: number; title: string;
      }>(),
    env.DB.prepare(`SELECT r.id, r.listing_id, r.state_code, r.reason, r.details, r.created_at, l.title
      FROM content_reports r JOIN listings l ON l.id = r.listing_id
      WHERE r.status = 'open' ORDER BY r.created_at ASC LIMIT 100`).all<{
        id: string; listing_id: string; state_code: string; reason: string; details: string; created_at: number; title: string;
      }>(),
    env.DB.prepare(`SELECT id, type, status, received_at, error FROM webhook_events
      WHERE status != 'processed' ORDER BY received_at DESC LIMIT 50`).all<{
        id: string; type: string; status: string; received_at: number; error: string | null;
      }>(),
  ]);

  return (
    <main className="legal-shell admin-shell">
      <header className="legal-header">
        <Link className="wordmark" href="/"><span className="wordmark-icon"><span /></span><span>statebid</span><strong>.lol</strong></Link>
        <div className="admin-identity"><span>{user.displayName}</span><form action="/api/admin/logout" method="post"><button type="submit">Sign out</button></form></div>
      </header>
      <section className="legal-hero"><span className="eyebrow"><span /> Operator only</span><h1>Trust &amp; payments</h1><p>Review verified payments, reports, moderation state, and webhook health.</p></section>

      <section className="admin-grid">
        <article className="admin-card"><h2>Listings</h2><div className="admin-table-wrap"><table><thead><tr><th>Listing</th><th>Standing</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {listings.results.map((listing) => <tr key={listing.id}><td><strong>{listing.title}</strong><small>{listing.normalized_key}</small></td><td>{money(listing.total_cents)}</td><td>{listing.status}</td><td>
            <form action="/api/admin/moderation" method="post"><input type="hidden" name="listingId" value={listing.id} /><input type="hidden" name="reason" value="Operator moderation" /><button name="action" value={listing.status === 'active' ? 'suspend' : 'reactivate'}>{listing.status === 'active' ? 'Suspend' : 'Reactivate'}</button><button name="action" value="block">Block</button></form>
          </td></tr>)}
        </tbody></table></div></article>

        <article className="admin-card"><h2>Open reports <span>{reports.results.length}</span></h2>{reports.results.length ? reports.results.map((report) => <div className="report-row" key={report.id}><div><strong>{report.title} · {report.state_code}</strong><small>{report.reason} · {new Date(report.created_at).toLocaleString()}</small><p>{report.details || 'No additional details.'}</p></div><form action="/api/admin/moderation" method="post"><input type="hidden" name="listingId" value={report.listing_id} /><input type="hidden" name="reportId" value={report.id} /><button name="action" value="resolve-report">Resolve</button><button name="action" value="suspend">Suspend</button></form></div>) : <p className="admin-empty">No open reports.</p>}</article>

        <article className="admin-card full"><h2>Recent payments</h2><div className="admin-table-wrap"><table><thead><tr><th>Listing</th><th>State</th><th>Paid</th><th>Reversed</th><th>Stripe record</th></tr></thead><tbody>
          {payments.results.map((payment) => <tr key={payment.id}><td><strong>{payment.title}</strong><small>{new Date(payment.paid_at).toLocaleString()}</small></td><td>{payment.state_code}</td><td>{money(String(payment.amount_cents))}</td><td>{money(String(payment.reversed_cents))}</td><td><code>{payment.stripe_payment_intent_id ?? payment.stripe_session_id}</code></td></tr>)}
        </tbody></table></div></article>

        <article className="admin-card full"><h2>Webhook attention <span>{webhooks.results.length}</span></h2>{webhooks.results.length ? webhooks.results.map((event) => <div className="webhook-row" key={event.id}><code>{event.id}</code><span>{event.type}</span><strong>{event.status}</strong><small>{event.error}</small></div>) : <p className="admin-empty">No failed or pending webhook events.</p>}</article>
      </section>
    </main>
  );
}

function money(cents: string) {
  const dollars = Number(BigInt(cents) / 100n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(dollars);
}
