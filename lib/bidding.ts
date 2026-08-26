export const MIN_BID_CENTS = 100n;
export const BID_INCREMENT_CENTS = 100n;
export const MAX_CHECKOUT_CENTS = 99_999_900n;
export const MAX_SQLITE_CENTS = 9_223_372_036_854_775_807n;

export class BidRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BidRuleError';
  }
}

export function parseCents(value: unknown, label = 'Amount') {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new BidRuleError(`${label} must be sent as a whole number of cents.`);
  }
  const cents = BigInt(value);
  if (cents > MAX_SQLITE_CENTS) throw new BidRuleError(`${label} is too large.`);
  return cents;
}

export function quoteBid(input: {
  targetCents: bigint;
  existingCents: bigint;
  leaderCents: bigint;
  bidderIsLeader: boolean;
}) {
  const { targetCents, existingCents, leaderCents, bidderIsLeader } = input;
  if (targetCents < MIN_BID_CENTS || targetCents % BID_INCREMENT_CENTS !== 0n) {
    throw new BidRuleError('Bids start at $1 and use whole-dollar totals.');
  }
  const requiredTargetCents = leaderCents === 0n
    ? MIN_BID_CENTS
    : bidderIsLeader
      ? existingCents + BID_INCREMENT_CENTS
      : leaderCents + BID_INCREMENT_CENTS;
  if (targetCents < requiredTargetCents) {
    throw new BidRuleError(`The current minimum target is $${requiredTargetCents / 100n}.`);
  }
  const chargeCents = targetCents - existingCents;
  if (chargeCents <= 0n) throw new BidRuleError('Your new total must increase this listing’s standing bid.');
  if (chargeCents > MAX_CHECKOUT_CENTS) {
    throw new BidRuleError('A single Checkout is limited to $999,999. Raise the listing again after payment.');
  }
  return { requiredTargetCents, chargeCents };
}
