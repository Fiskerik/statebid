import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminUser, isAdminConfigured } from '@/lib/server/admin';

export const metadata: Metadata = { title: 'Operator sign in', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string; returnTo?: string }> }) {
  if (await getAdminUser()) redirect('/admin');
  const query = await searchParams;
  const configured = isAdminConfigured();
  const returnTo = query.returnTo?.startsWith('/') && !query.returnTo.startsWith('//') ? query.returnTo : '/admin';
  return <main className="success-shell"><Link className="wordmark" href="/"><span className="wordmark-icon"><span /></span><span>statebid</span><strong>.lol</strong></Link><section className="success-card admin-login-card">
    <span className="state-card-kicker">Operator only</span><h1>Sign in to operations.</h1>
    {!configured ? <p>Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET in Vercel before using this route.</p> : <form action="/api/admin/login" method="post" className="admin-login-form">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>Username<input name="username" autoComplete="username" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {query.error ? <p role="alert">The username or password was not accepted.</p> : null}
      <button className="primary-button state-cta" type="submit">Sign in</button>
    </form>}
    <Link className="text-button" href="/">Return to the map</Link>
  </section></main>;
}
