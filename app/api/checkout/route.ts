import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { ensureDatabase } from '@/db/runtime';
import { parseCents, quoteBid } from '@/lib/bidding';
import { normalizeDestination } from '@/lib/listings';
import { getListingByKey, getListingTotal, getStateLeaderTotal, getStateWinner } from '@/lib/server/board';
import { assertNotBlocked, enforceRateLimit, HttpError, jsonError, verifyTurnstile } from '@/lib/server/security';
import { getSiteUrl, getStripe } from '@/lib/server/stripe';
import { STATE_BY_CODE, type StateCode } from '@/lib/states';
import type { CheckoutQuote, DestinationType } from '@/lib/types';

const schema = z.object({
  stateCode: z.string().length(2),
  destination: z.string().min(1).max(2048),
  previewId: z.string().uuid().nullable().optional(),
  targetTotalCents: z.string().regex(/^\d+$/),
  termsAccepted: z.literal(true),
  turnstileToken: z.string().max(4096).optional(),
});

type PreviewRow = {
  id: string;
  normalized_key: string;
  destination_type: DestinationType;
  canonical_url: string;
  title: string;
  description: string;
  logo_key: string | null;
  logo_content_type: string | null;
  expires_at: number;
};

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'checkout', 6, 60);
    const input = schema.parse(await request.json());
    await verifyTurnstile(input.turnstileToken, request);
    const stateCode = input.stateCode.toUpperCase() as StateCode;
    const state = STATE_BY_CODE.get(stateCode);
    if (!state) throw new HttpError(400, 'Choose one of the 50 claimable states.');

    const destination = normalizeDestination(input.destination);
    await assertNotBlocked(destination.normalizedKey, new URL(destination.canonicalUrl).hostname);
    await ensureDatabase();
    const existing = await getListingByKey(destination.normalizedKey);
    if (existing?.status === 'suspended') throw new HttpError(403, 'This listing is suspended and cannot receive bids.');

    let identity: PreviewRow;
    if (existing) {
      identity = {
        id: existing.id,
        normalized_key: existing.normalized_key,
        destination_type: existing.destination_type,
        canonical_url: existing.canonical_url,
        title: existing.title,
        description: existing.description,
        logo_key: existing.logo_key,
        logo_content_type: existing.logo_content_type,
        expires_at: Number.MAX_SAFE_INTEGER,
      };
    } else {
      if (!input.previewId) throw new HttpError(400, 'Create a fresh listing preview before Checkout.');
      const preview = await env.DB.prepare(`SELECT id, normalized_key, destination_type, canonical_url,
          title, description, logo_key, logo_content_type, expires_at
        FROM listing_previews WHERE id = ? LIMIT 1`).bind(input.previewId).first<PreviewRow>();
      if (!preview || preview.normalized_key !== destination.normalizedKey || preview.expires_at <= Date.now()) {
        throw new HttpError(400, 'That listing preview expired. Create a fresh preview and try again.');
      }
      identity = preview;
    }

    const targetCents = parseCents(input.targetTotalCents, 'Target total');
    const [existingCents, leaderCents, winner] = await Promise.all([
      getListingTotal(destination.normalizedKey, stateCode),
      getStateLeaderTotal(stateCode),
      getStateWinner(stateCode),
    ]);
    const quote = quoteBid({
      targetCents,
      existingCents,
      leaderCents,
      bidderIsLeader: winner?.listing.normalizedKey === destination.normalizedKey,
    });
    const attemptId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 30 * 60 * 1000;
    await env.DB.prepare(`INSERT INTO bid_attempts(
        id, normalized_key, destination_type, canonical_url, provisional_title,
        provisional_description, provisional_logo_key, provisional_logo_content_type,
        state_code, target_total_cents, existing_total_cents, charge_cents,
        status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS INTEGER), CAST(? AS INTEGER), CAST(? AS INTEGER), 'pending', ?, ?)`)
      .bind(
        attemptId,
        destination.normalizedKey,
        identity.destination_type,
        identity.canonical_url,
        identity.title,
        identity.description,
        identity.logo_key,
        identity.logo_content_type,
        stateCode,
        targetCents.toString(),
        existingCents.toString(),
        quote.chargeCents.toString(),
        now,
        expiresAt,
      ).run();

    const stripe = getStripe();
    const siteUrl = getSiteUrl();
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        client_reference_id: attemptId,
        metadata: { attemptId },
        payment_intent_data: { metadata: { attemptId } },
        billing_address_collection: 'required',
        automatic_tax: { enabled: env.STRIPE_TAX_ENABLED === 'true' },
        expires_at: Math.floor(expiresAt / 1000),
        success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/?state=${stateCode}&checkout=cancelled`,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Number(quote.chargeCents),
            product_data: {
              name: `${state.name} standing bid`,
              description: `Raise ${identity.title} to $${targetCents / 100n} on StateBid`,
            },
          },
        }],
      }, { idempotencyKey: `statebid-checkout-${attemptId}` });
      if (!session.url) throw new Error('Stripe did not return a hosted Checkout URL.');
      await env.DB.prepare(`UPDATE bid_attempts SET stripe_session_id = ? WHERE id = ? AND status = 'pending'`)
        .bind(session.id, attemptId).run();
      const response: CheckoutQuote = {
        attemptId,
        stateCode,
        listingKey: destination.normalizedKey,
        targetTotalCents: targetCents.toString(),
        existingTotalCents: existingCents.toString(),
        leaderTotalCents: leaderCents.toString(),
        chargeCents: quote.chargeCents.toString(),
        expiresAt,
        checkoutUrl: session.url,
      };
      return Response.json(response, { status: 201 });
    } catch (error) {
      await env.DB.prepare(`UPDATE bid_attempts SET status = 'failed' WHERE id = ? AND status = 'pending'`).bind(attemptId).run();
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}
