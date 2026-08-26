export const ROLLING_DAY_MS = 24 * 60 * 60 * 1000;

export function isInRollingDay(paidAt: number, now: number) {
  return paidAt >= now - ROLLING_DAY_MS && paidAt <= now;
}
