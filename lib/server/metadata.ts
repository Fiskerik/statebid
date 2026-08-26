import { env } from 'cloudflare:workers';
import { sanitizeImage } from '@/lib/images';
import type { NormalizedDestination } from '@/lib/listings';
import { assertPublicNetworkHost, HttpError } from './security';

export type DiscoveredMetadata = {
  title: string;
  description: string;
  logoUrl: string | null;
};

export async function discoverMetadata(destination: NormalizedDestination): Promise<DiscoveredMetadata> {
  const { response, finalUrl } = await safeFetch(destination.canonicalUrl, 'document');
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) throw new HttpError(400, 'The destination must return a public HTML page.');
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > 1_000_000) throw new HttpError(400, 'The destination page is too large to preview safely.');
  const html = (await response.text()).slice(0, 1_000_000);
  const final = new URL(finalUrl);
  const title = cleanText(
    findMeta(html, 'property', 'og:title') ??
    findMeta(html, 'name', 'twitter:title') ??
    findTitle(html) ??
    destination.fallbackTitle,
  ).slice(0, 120);
  const description = cleanText(
    findMeta(html, 'property', 'og:description') ??
    findMeta(html, 'name', 'description') ??
    '',
  ).slice(0, 280);
  const icon = findIcon(html);
  const socialImage = findMeta(html, 'property', 'og:image') ?? findMeta(html, 'name', 'twitter:image');
  const candidate = icon ?? socialImage ?? (destination.type === 'website' ? '/favicon.ico' : null);
  let logoUrl: string | null = null;
  if (candidate) {
    try {
      logoUrl = new URL(decodeEntities(candidate), final).toString();
    } catch {
      logoUrl = null;
    }
  }
  return { title: title || destination.fallbackTitle, description, logoUrl };
}

export async function cacheRemoteLogo(url: string, baseKey: string) {
  const { response } = await safeFetch(url, 'image');
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > 2 * 1024 * 1024) throw new HttpError(400, 'The destination logo is too large.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  const image = sanitizeImage(bytes, { allowIco: true });
  const key = `${baseKey}.${image.extension}`;
  await env.FILES.put(key, image.bytes, {
    httpMetadata: { contentType: image.contentType, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { source: 'fetched' },
  });
  return { key, contentType: image.contentType };
}

async function safeFetch(initialUrl: string, kind: 'document' | 'image') {
  let current = new URL(initialUrl);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (current.protocol !== 'https:') throw new HttpError(400, 'Metadata previews require a public HTTPS destination.');
    await assertPublicNetworkHost(current.hostname);
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(kind === 'document' ? 6000 : 4500),
      headers: {
        'user-agent': 'StateBidBot/1.0 (+https://statebid.lol/about)',
        accept: kind === 'document' ? 'text/html,application/xhtml+xml' : 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirect === 3) throw new HttpError(400, 'The destination redirected too many times.');
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new HttpError(400, `The destination returned HTTP ${response.status}.`);
    return { response, finalUrl: current.toString() };
  }
  throw new HttpError(400, 'The destination could not be fetched.');
}

function findTitle(html: string) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
}

function findMeta(html: string, attribute: 'name' | 'property', value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const first = new RegExp(`<meta[^>]+${attribute}=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
  const second = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attribute}=["']${escaped}["'][^>]*>`, 'i');
  return html.match(first)?.[1] ?? html.match(second)?.[1] ?? null;
}

function findIcon(html: string) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (!/rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["']/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) return href;
  }
  return null;
}

function cleanText(value: string) {
  return decodeEntities(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeEntities(value: string) {
  const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return value.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return entities[entity.toLowerCase()] ?? `&${entity};`;
  });
}
