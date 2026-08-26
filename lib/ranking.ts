export type Standing = { id: string; totalCents: bigint; reachedAt: number; active: boolean };

export function selectWinner<T extends Standing>(standings: readonly T[]) {
  return standings.filter((item) => item.active && item.totalCents > 0n).sort((a, b) => {
    if (a.totalCents !== b.totalCents) return a.totalCents > b.totalCents ? -1 : 1;
    if (a.reachedAt !== b.reachedAt) return a.reachedAt - b.reachedAt;
    return a.id.localeCompare(b.id);
  })[0] ?? null;
}
