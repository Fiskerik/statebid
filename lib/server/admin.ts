import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/server/platform';

const COOKIE_NAME = 'statebid_operator';
const SESSION_MS = 8 * 60 * 60 * 1000;

export type OperatorUser = {
  userId: string;
  displayName: string;
};

export function isAdminConfigured() {
  return Boolean(
    env.ADMIN_USERNAME
    && env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 12
    && env.ADMIN_SESSION_SECRET && env.ADMIN_SESSION_SECRET.length >= 32,
  );
}

export async function validateAdminCredentials(username: string, password: string) {
  if (!isAdminConfigured()) return false;
  return safeEqual(username, env.ADMIN_USERNAME!) && safeEqual(password, env.ADMIN_PASSWORD!);
}

export async function createAdminSession() {
  if (!isAdminConfigured()) throw new Error('Operator authentication is not configured.');
  const expiresAt = Date.now() + SESSION_MS;
  const signature = await sign(String(expiresAt));
  const store = await cookies();
  store.set(COOKIE_NAME, `v1.${expiresAt}.${signature}`, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

export async function getAdminUser(): Promise<OperatorUser | null> {
  if (!isAdminConfigured()) return null;
  const value = (await cookies()).get(COOKIE_NAME)?.value ?? '';
  const [version, expiresRaw, signature] = value.split('.');
  const expiresAt = Number(expiresRaw);
  if (version !== 'v1' || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || !signature) return null;
  const expected = await sign(expiresRaw);
  if (!safeEqual(signature, expected)) return null;
  return { userId: 'vercel-operator', displayName: env.ADMIN_USERNAME! };
}

export async function requireAdminPage(returnTo = '/admin') {
  const user = await getAdminUser();
  if (!user) redirect(`/admin/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`);
  return user;
}

export async function requireAdminApi() {
  if (!isAdminConfigured()) {
    return { response: Response.json({ error: 'Operator authentication is not configured.' }, { status: 503 }) } as const;
  }
  const user = await getAdminUser();
  if (!user) return { response: Response.json({ error: 'Authentication required.' }, { status: 401 }) } as const;
  return { user } as const;
}

function safeReturnTo(value: string) {
  return value.startsWith('/') && !value.startsWith('//') ? value : '/admin';
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.ADMIN_SESSION_SECRET!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

function safeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}
