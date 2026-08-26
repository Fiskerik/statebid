import { createAdminSession, validateAdminCredentials } from '@/lib/server/admin';
import { isDatabaseConfigured } from '@/lib/server/platform';
import { enforceRateLimit, jsonError } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return new Response('Forbidden', { status: 403 });
    if (isDatabaseConfigured()) await enforceRateLimit(request, 'admin-login', 5, 5 * 60);
    const form = await request.formData();
    const username = String(form.get('username') ?? '').slice(0, 200);
    const password = String(form.get('password') ?? '').slice(0, 500);
    const requested = String(form.get('returnTo') ?? '/admin');
    const returnTo = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/admin';
    if (!await validateAdminCredentials(username, password)) {
      return Response.redirect(new URL(`/admin/login?error=1&returnTo=${encodeURIComponent(returnTo)}`, request.url), 303);
    }
    await createAdminSession();
    return Response.redirect(new URL(returnTo, request.url), 303);
  } catch (error) {
    return jsonError(error);
  }
}
