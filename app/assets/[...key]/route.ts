import { env } from '@/lib/server/platform';

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const objectKey = key.join('/');
  if (!/^[a-zA-Z0-9/_-]+\.(png|jpe?g|webp|ico)$/i.test(objectKey) || objectKey.includes('..')) {
    return new Response('Invalid asset key', { status: 400 });
  }
  const object = await env.FILES.get(objectKey);
  if (!object) return new Response('Not found', { status: 404 });
  if (request.headers.get('if-none-match') === object.httpEtag) {
    return new Response(null, { status: 304, headers: { etag: object.httpEtag } });
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('content-security-policy', "default-src 'none'; img-src 'self'; sandbox");
  return new Response(object.body, { headers });
}
