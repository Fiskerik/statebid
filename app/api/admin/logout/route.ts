import { clearAdminSession } from '@/lib/server/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return new Response('Forbidden', { status: 403 });
  await clearAdminSession();
  return Response.redirect(new URL('/', request.url), 303);
}
