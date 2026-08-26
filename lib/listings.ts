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
    BLOCKED_HOSTS.has(hostname) ||
    isPrivateIpLiteral(hostname)
  ) {
    throw new DestinationError('That destination is not allowed.');
  }
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
