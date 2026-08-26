import { describe, expect, it } from 'vitest';
import { lockFirstIdentity } from '@/lib/identity';
import { selectWinner } from '@/lib/ranking';
import { isInRollingDay, ROLLING_DAY_MS } from '@/lib/rolling';

describe('ranking determinism', () => {
  it('selects the highest active total', () => {
    expect(selectWinner([{ id: 'a', totalCents: 100n, reachedAt: 1, active: true }, { id: 'b', totalCents: 200n, reachedAt: 2, active: true }])?.id).toBe('b');
  });

  it('breaks equal totals by first reached time and stable id', () => {
    expect(selectWinner([{ id: 'b', totalCents: 200n, reachedAt: 10, active: true }, { id: 'a', totalCents: 200n, reachedAt: 10, active: true }, { id: 'c', totalCents: 200n, reachedAt: 8, active: true }])?.id).toBe('c');
    expect(selectWinner([{ id: 'b', totalCents: 200n, reachedAt: 10, active: true }, { id: 'a', totalCents: 200n, reachedAt: 10, active: true }])?.id).toBe('a');
  });

  it('excludes suspended standings so the next listing wins', () => {
    expect(selectWinner([{ id: 'top', totalCents: 500n, reachedAt: 1, active: false }, { id: 'next', totalCents: 300n, reachedAt: 2, active: true }])?.id).toBe('next');
  });
});

describe('rolling 24-hour boundary', () => {
  const now = 2_000_000_000_000;
  it('includes the exact boundary and excludes older payments', () => {
    expect(isInRollingDay(now - ROLLING_DAY_MS, now)).toBe(true);
    expect(isInRollingDay(now - ROLLING_DAY_MS - 1, now)).toBe(false);
    expect(isInRollingDay(now + 1, now)).toBe(false);
  });
});

describe('immutable first-listing identity', () => {
  const first = { normalizedKey: 'web:example.com', canonicalUrl: 'https://example.com', title: 'First', description: 'Locked', logoKey: 'first.png' };
  const racing = { ...first, title: 'Racing edit', logoKey: 'second.png' };
  it('locks the first successful identity and ignores later provisional metadata', () => {
    expect(lockFirstIdentity(first, racing)).toBe(first);
    expect(lockFirstIdentity(null, first)).toEqual(first);
  });
});
