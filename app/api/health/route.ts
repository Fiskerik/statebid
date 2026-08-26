import { env, isAssetStorageConfigured, isDatabaseConfigured } from '@/lib/server/platform';
import { ensureDatabase } from '@/db/runtime';
import { isAdminConfigured } from '@/lib/server/admin';

export async function GET() {
  const checks = {
    database: false,
    assets: isAssetStorageConfigured(),
    stripe: Boolean(env.STRIPE_SECRET_KEY),
    webhook: Boolean(env.STRIPE_WEBHOOK_SECRET),
    siteUrl: Boolean(env.SITE_URL),
    admin: isAdminConfigured(),
    legalIdentity: Boolean(env.OPERATOR_NAME && env.OPERATOR_ADDRESS && env.SUPPORT_EMAIL),
  };
  if (isDatabaseConfigured()) {
    try {
      await ensureDatabase();
      await env.DB.prepare('SELECT 1').first();
      checks.database = true;
    } catch (error) {
      console.error('StateBid health database failure', error);
    }
  }
  const ready = Object.values(checks).every(Boolean);
  return Response.json({ status: ready ? 'ready' : 'setup_required', checks }, {
    status: 200,
    headers: { 'cache-control': 'no-store' },
  });
}
