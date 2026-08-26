import { describe, expect, it } from 'vitest';
import { MAX_CHECKOUT_CENTS, parseCents, quoteBid } from '@/lib/bidding';

describe('bid quote rules', () => {
  it('starts empty states at one dollar', () => {
    expect(quoteBid({ targetCents: 100n, existingCents: 0n, leaderCents: 0n, bidderIsLeader: false })).toEqual({ requiredTargetCents: 100n, chargeCents: 100n });
  });

  it('charges a returning listing only the difference', () => {
    expect(quoteBid({ targetCents: 35_000n, existingCents: 20_000n, leaderCents: 30_000n, bidderIsLeader: false }).chargeCents).toBe(15_000n);
  });

  it('requires challengers to move one dollar ahead', () => {
    expect(() => quoteBid({ targetCents: 20_000n, existingCents: 0n, leaderCents: 20_000n, bidderIsLeader: false })).toThrow('current minimum');
    expect(quoteBid({ targetCents: 20_100n, existingCents: 0n, leaderCents: 20_000n, bidderIsLeader: false }).chargeCents).toBe(20_100n);
  });

  it('lets the current leader fortify by one dollar', () => {
    expect(quoteBid({ targetCents: 20_100n, existingCents: 20_000n, leaderCents: 20_000n, bidderIsLeader: true }).chargeCents).toBe(100n);
  });

  it('rejects cents, non-decimal wire values, and an oversized Checkout', () => {
    expect(() => quoteBid({ targetCents: 101n, existingCents: 0n, leaderCents: 0n, bidderIsLeader: false })).toThrow('whole-dollar');
    expect(() => parseCents('1e3')).toThrow('whole number of cents');
    expect(() => quoteBid({ targetCents: MAX_CHECKOUT_CENTS + 100n, existingCents: 0n, leaderCents: 0n, bidderIsLeader: false })).toThrow('$999,999');
  });
});
