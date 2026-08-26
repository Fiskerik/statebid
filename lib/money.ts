import { MAX_SQLITE_CENTS } from './bidding';

export function serializeCents(value: bigint) {
  if (value < 0n || value > MAX_SQLITE_CENTS) throw new RangeError('Cents are outside the supported 64-bit range.');
  return value.toString(10);
}

export function formatWholeDollarCents(value: string) {
  const dollars = BigInt(value) / 100n;
  return `$${dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
