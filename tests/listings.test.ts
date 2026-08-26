import { describe, expect, it } from 'vitest';
import { normalizeDestination } from '@/lib/listings';

describe('destination normalization', () => {
  it('normalizes host, default port, query, hash, and root slash', () => {
    expect(normalizeDestination('https://WWW.Example.COM:443/?utm_source=x#top')).toEqual({
      type: 'website', normalizedKey: 'web:example.com', canonicalUrl: 'https://example.com', fallbackTitle: 'example.com',
    });
  });

  it('retains meaningful product paths', () => {
    expect(normalizeDestination('example.com/Product/')).toMatchObject({ normalizedKey: 'web:example.com/Product', canonicalUrl: 'https://example.com/Product' });
  });

  it.each(['@StateBid', 'https://x.com/StateBid', 'https://twitter.com/statebid'])('normalizes X profiles: %s', (input) => {
    expect(normalizeDestination(input)).toMatchObject({ type: 'x', normalizedKey: 'x:statebid', canonicalUrl: 'https://x.com/statebid' });
  });

  it.each(['javascript:alert(1)', 'http://localhost', 'https://127.0.0.1', 'https://[::ffff:127.0.0.1]', 'bit.ly/example', 'subdomain.bit.ly/example', 'discord.gg/example', 'https://user:pass@example.com', 'https://example.com/casino'])('rejects unsafe destinations: %s', (input) => {
    expect(() => normalizeDestination(input)).toThrow();
  });

  it('rejects X posts and reserved pages', () => {
    expect(() => normalizeDestination('https://x.com/statebid/status/123')).toThrow();
    expect(() => normalizeDestination('@home')).toThrow();
  });
});
