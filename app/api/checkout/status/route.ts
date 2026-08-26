import { getCheckoutResult, getStateWinner } from '@/lib/server/board';
import { HttpError, jsonError } from '@/lib/server/security';
import { STATE_BY_CODE } from '@/lib/states';
import type { CheckoutStatus, PublicListing } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const sessionId = new URL(request.url).searchParams.get('session_id') ?? '';
    if (!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) throw new HttpError(400, 'A valid Checkout Session ID is required.');
    const result = await getCheckoutResult(sessionId);
    if (!result) throw new HttpError(404, 'Checkout attempt not found.');
    const state = STATE_BY_CODE.get(result.state_code);
    if (!state) throw new HttpError(500, 'Checkout contains an invalid state.');
    const winner = await getStateWinner(result.state_code);
    const listing: PublicListing | null = result.listing_id && result.title && result.canonical_url ? {
      id: result.listing_id,
      normalizedKey: result.normalized_key,
      destinationType: result.destination_type,
      canonicalUrl: result.canonical_url,
      title: result.title,
      description: result.description ?? '',
      logoUrl: result.logo_key ? `/assets/${result.logo_key}` : null,
    } : null;
    const isWinner = Boolean(listing && winner?.listing.id === listing.id);
    const nextTarget = winner
      ? BigInt(isWinner ? result.listing_total_cents : winner.totalCents) + 100n
      : 100n;
    const response: CheckoutStatus = {
      status: result.status as CheckoutStatus['status'],
      stateCode: result.state_code,
      stateName: state.name,
      listing,
      listingTotalCents: result.listing_total_cents,
      creditedCents: String(result.charge_cents),
      isWinner,
      winner,
      nextTargetCents: nextTarget.toString(),
    };
    return Response.json(response, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
