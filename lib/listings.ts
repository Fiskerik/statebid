import type { DestinationType } from './types';

const BLOCKED_HOSTS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'discord.com',
  'discord.gg',
  't.me',
  'telegram.me',
  'chat.whatsapp.com',
  'signal.group',
  'm.me',
]);

const RESERVED_X_PATHS = new Set([
  'home', 'explore', 'notifications', 'messages', 'i', 'intent', 'search',
  'settings', 'compose', 'share', 'hashtag', 'tos', 'privacy',
]);

const PROHIBITED_INDICATORS = new Set([
  'porn', 'porno', 'pornography', 'xxx', 'escort', 'malware', 'phishing', 'phish',
  'ransomware', 'counterfeit', 'casino', 'sportsbook', 'betting', 'firearms',
  'weapons', 'cannabis', 'paydayloan', 'paydayloans',
]);

export type NormalizedDestination = {
  type: DestinationType;
  normalizedKey: string;
  canonicalUrl: string;
  fallbackTitle: string;
};

export class DestinationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DestinationError';
  }
}

export function normalizeDestination(rawInput: string): NormalizedDestination {
  const input = rawInput.trim();
  if (!input) throw new DestinationError('Enter a public website or X handle.');

  if (input.startsWith('@')) return normalizeXHandle(input.slice(1));

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw new DestinationError('That destination is not a valid URL or X handle.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new DestinationError('Only public HTTP and HTTPS destinations are supported.');
  }
  if (url.username || url.password) {
    throw new DestinationError('URLs containing credentials are not allowed.');
  }

  const hostname = normalizeHostname(url.hostname);
  if (hostname === 'x.com' || hostname === 'twitter.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 1 || RESERVED_X_PATHS.has(parts[0].toLowerCase())) {
      throw new DestinationError('Use an X profile handle, not a post or reserved X page.');
    }
    return normalizeXHandle(parts[0]);
  }

  assertAllowedHostname(hostname);
  const port =
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
      ? ''
      : url.port;
  const pathname = normalizePathname(url.pathname);
  const authority = port ? `${hostname}:${port}` : hostname;
  const canonicalUrl = `https://${authority}${pathname}`;
  assertNoProhibitedIndicators(canonicalUrl);

  return {
    type: 'website',
    normalizedKey: `web:${authority}${pathname}`,
    canonicalUrl,
    fallbackTitle: hostname.replace(/^www\./, ''),
  };
}

function normalizeXHandle(value: string): NormalizedDestination {
  const handle = value.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(handle) || RESERVED_X_PATHS.has(handle)) {
    throw new DestinationError('Enter a valid X profile handle.');
  }
  assertNoProhibitedIndicators(handle);
  return {
    type: 'x',
    normalizedKey: `x:${handle}`,
    canonicalUrl: `https://x.com/${handle}`,
    fallbackTitle: `@${handle}`,
  };
}

export function normalizeHostname(value: string) {
  const lower = value.toLowerCase().replace(/\.$/, '');
  return lower.startsWith('www.') ? lower.slice(4) : lower;
}

export function normalizePathname(value: string) {
  const compact = value.replace(/\/{2,}/g, '/');
  if (compact === '/' || compact === '') return '';
  return compact.replace(/\/$/, '');
}

export function assertAllowedHostname(hostname: string) {
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    [...BLOCKED_HOSTS].some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`)) ||
    isPrivateIpLiteral(hostname) ||
    isPrivateIpv6Literal(hostname)
  ) {
    throw new DestinationError('That destination is not allowed.');
  }
}

export function assertNoProhibitedIndicators(value: string) {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* URL parsing will preserve malformed escapes as inert text. */ }
  const tokens = decoded.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some((token) => PROHIBITED_INDICATORS.has(token))) {
    throw new DestinationError('That destination contains a prohibited or regulated-content indicator.');
  }
}

export function isPrivateIpv6Literal(hostname: string) {
  const value = hostname.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  if (!value.includes(':')) return false;
  const parts = expandIpv6(value);
  if (!parts) return true;
  const first = parts[0];
  if (parts.every((part) => part === 0) || parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1) return true;
  if ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xffc0) === 0xfec0 || (first & 0xff00) === 0xff00) return true;
  if (first === 0x2001 && (parts[1] === 0x0db8 || parts[1] === 0 || (parts[1] & 0xfff0) === 0x0010)) return true;
  if (first === 0x2002 || (first === 0x0064 && parts[1] === 0xff9b)) return true;
  if (parts.slice(0, 5).every((part) => part === 0) && (parts[5] === 0 || parts[5] === 0xffff)) {
    const address = `${parts[6] >> 8}.${parts[6] & 255}.${parts[7] >> 8}.${parts[7] & 255}`;
    return isPrivateIpLiteral(address);
  }
  return false;
}

function expandIpv6(value: string) {
  if ((value.match(/::/g) ?? []).length > 1) return null;
  const [leftRaw, rightRaw = ''] = value.split('::');
  const parseSide = (side: string) => side ? side.split(':').filter(Boolean).flatMap((part) => {
    if (part.includes('.')) {
      const octets = part.split('.').map(Number);
      if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return [Number.NaN];
      return [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
    }
    return /^[0-9a-f]{1,4}$/.test(part) ? [Number.parseInt(part, 16)] : [Number.NaN];
  }) : [];
  const left = parseSide(leftRaw); const right = parseSide(rightRaw);
  if ([...left, ...right].some(Number.isNaN)) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (!value.includes('::') && missing !== 0)) return null;
  return [...left, ...Array.from({ length: missing }, () => 0), ...right];
}

export function isPrivateIpLiteral(hostname: string) {
  const unwrapped = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (unwrapped === '::1' || unwrapped === '::' || unwrapped.startsWith('fe80:') || unwrapped.startsWith('fc') || unwrapped.startsWith('fd')) return true;
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(unwrapped)) return false;
  const parts = unwrapped.split('.').map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return true;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 192 && parts[1] === 0) ||
    (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19 || parts[1] === 51)) ||
    (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    parts[0] >= 224
  );
}

export function listingSlug(normalizedKey: string) {
  return normalizedKey
    .replace(/^[a-z]+:/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
