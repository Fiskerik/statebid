import { getBoardSnapshot } from '@/lib/server/board';

export async function GET(request: Request) {
  const snapshot = await getBoardSnapshot(Math.floor(Date.now() / 5000) * 5000);
  const body = JSON.stringify(snapshot);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const etag = `"${[...new Uint8Array(digest)].slice(0, 12).map((part) => part.toString(16).padStart(2, '0')).join('')}"`;
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { etag } });
  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=5, stale-while-revalidate=10',
      etag,
    },
  });
}
