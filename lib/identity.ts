export type ImmutableIdentity = { normalizedKey: string; title: string; description: string; canonicalUrl: string; logoKey: string | null };

export function lockFirstIdentity(existing: ImmutableIdentity | null, provisional: ImmutableIdentity) {
  return existing ?? Object.freeze({ ...provisional });
}
