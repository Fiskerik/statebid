import { env } from '@/lib/server/platform';
import { ensureDatabase } from '@/db/runtime';
import { assertAllowedHostname, isPrivateIpLiteral, isPrivateIpv6Literal } from '@/lib/listings';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function hashValue(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

export async function enforceRateLimit(
  request: Request,
  action: string,
  limit: number,
  windowSeconds: number,
) {
  await ensureDatabase();
  const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]
    ?? request.headers.get('cf-connecting-ip')
    ?? 'local';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  const fingerprint = await hashValue(`${env.RATE_LIMIT_SALT ?? 'statebid-local'}:${ip}:${userAgent}`);
  const key = `${action}:${fingerprint}`;
  const now = Date.now();
  const resetAt = now + windowSeconds * 1000;
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits(key, count, reset_at)
     VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
       reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
     RETURNING count, reset_at`,
  ).bind(key, resetAt, now, now).first<{ count: number; reset_at: number }>();
  if (row && row.count > limit) throw new HttpError(429, 'Too many requests. Please wait and try again.');
}

export async function verifyTurnstile(token: string | undefined, request: Request) {
  if (!env.TURNSTILE_SECRET_KEY) return;
  if (!token) throw new HttpError(400, 'Complete the security check before continuing.');
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (ip) body.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  const result = (await response.json()) as { success?: boolean };
  if (!result.success) throw new HttpError(400, 'The security check failed. Please try again.');
}

export async function assertNotBlocked(normalizedKey: string, hostname?: string) {
  await ensureDatabase();
  const candidates = [normalizedKey, hostname].filter(Boolean) as string[];
  for (const value of candidates) {
    const row = await env.DB.prepare(
      `SELECT 1 AS blocked FROM blocklist WHERE value = ? LIMIT 1`,
    ).bind(value).first();
    if (row) throw new HttpError(403, 'That destination is not accepted on StateBid.');
  }
}

export async function assertPublicNetworkHost(hostname: string) {
  assertAllowedHostname(hostname);
  if (isIpLiteral(hostname)) {
    if (isPrivateIpLiteral(hostname) || isPrivateIpv6Literal(hostname)) throw new HttpError(400, 'Private network destinations are not allowed.');
    return;
  }

  const answers = await Promise.all(['A', 'AAAA'].map(async (type) => {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`;
    const response = await fetch(url, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return [] as string[];
    const payload = (await response.json()) as { Answer?: Array<{ data?: string }> };
    return (payload.Answer ?? []).map((answer) => answer.data ?? '').filter(Boolean);
  }));
  const addresses = answers.flat();
  if (!addresses.length) throw new HttpError(400, 'The destination hostname could not be verified.');
  if (addresses.some((address) => isPrivateIpLiteral(address) || isPrivateIpv6Literal(address))) {
    throw new HttpError(400, 'Private network destinations are not allowed.');
  }
}

function isIpLiteral(hostname: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.name === 'PlatformSetupError') {
    return Response.json({ error: 'StateBid is not fully configured yet.' }, { status: 503 });
  }
  if (error instanceof Error && ['DestinationError', 'BidRuleError', 'ZodError'].includes(error.name)) {
    return Response.json({ error: error.name === 'ZodError' ? 'Check the submitted fields and try again.' : error.message }, { status: 400 });
  }
  console.error('StateBid request failed', error);
  return Response.json({ error: 'The request could not be completed. Please try again.' }, { status: 500 });
}
