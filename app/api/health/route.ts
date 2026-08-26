import { env } from 'cloudflare:workers';
import { ensureDatabase } from '@/db/runtime';

export async function GET() {
  const checks = {
    database: false,
    assets: Boolean(env.FILES),
    stripe: Boolean(env.STRIPE_SECRET_KEY),
    webhook: Boolean(env.STRIPE_WEBHOOK_SECRET),
    siteUrl: Boolean(env.SITE_URL),
    admin: Boolean(env.ADMIN_USER_IDS || env.ADMIN_EMAIL),
    legalIdentity: Boolean(env.OPERATOR_NAME && env.OPERATOR_ADDRESS && env.SUPPORT_EMAIL),
  };
  try {
    await ensureDatabase();
    await env.DB.prepare('SELECT 1').first();
    checks.database = true;
  } catch (error) {
    console.error('StateBid health database failure', error);
  }
  const ready = Object.values(checks).every(Boolean);
  return Response.json({ status: ready ? 'ready' : 'setup_required', checks }, {
    status: checks.database ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  });
}
