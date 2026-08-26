import { env } from '@/lib/server/platform';
import Stripe from 'stripe';
import { ensureDatabase } from '@/db/runtime';
import { getStripe } from '@/lib/server/stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: 'Webhook signature configuration is missing.' }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return Response.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
  }

  await ensureDatabase();
  const previous = await env.DB.prepare('SELECT status FROM webhook_events WHERE id = ? LIMIT 1')
    .bind(event.id).first<{ status: string }>();
  if (previous?.status === 'processed') return Response.json({ received: true, duplicate: true });
  await env.DB.prepare(`INSERT INTO webhook_events(id, type, status, received_at)
      VALUES (?, ?, 'received', ?)
      ON CONFLICT(id) DO UPDATE SET status = 'received', error = NULL`)
    .bind(event.id, event.type, Date.now()).run();

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') await fulfillCheckout(stripe, event, session);
    } else if (event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      const attemptId = session.metadata?.attemptId;
      if (attemptId) {
        await env.DB.prepare(`UPDATE bid_attempts SET status = ? WHERE id = ? AND status = 'pending'`)
          .bind(event.type.endsWith('expired') ? 'expired' : 'failed', attemptId).run();
      }
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      await applyReversal(event, charge, charge.amount_refunded, 'refund');
    } else if (event.type.startsWith('charge.dispute.')) {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;
      const charge = await stripe.charges.retrieve(chargeId);
      const won = dispute.status === 'won';
      const desired = won ? charge.amount_refunded : Math.max(charge.amount_refunded, dispute.amount);
      await applyReversal(event, charge, desired, `dispute:${dispute.status}`);
    }

    await env.DB.prepare(`UPDATE webhook_events SET status = 'processed', processed_at = ?, error = NULL WHERE id = ?`)
      .bind(Date.now(), event.id).run();
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Webhook processing failed.';
    console.error('StateBid Stripe webhook failed', { eventId: event.id, eventType: event.type, error: message });
    await env.DB.prepare(`UPDATE webhook_events SET status = 'failed', error = ? WHERE id = ?`)
      .bind(message, event.id).run();
    return Response.json({ error: 'Webhook processing failed; Stripe may retry.' }, { status: 500 });
  }
}

async function fulfillCheckout(stripe: Stripe, event: Stripe.Event, session: Stripe.Checkout.Session) {
  const attemptId = session.metadata?.attemptId;
  if (!attemptId || session.client_reference_id !== attemptId) throw new Error('Checkout attempt metadata mismatch.');
  const attempt = await env.DB.prepare(`SELECT id, normalized_key, destination_type, canonical_url,
      provisional_title, provisional_description, provisional_logo_key, provisional_logo_content_type,
      state_code, charge_cents, stripe_session_id, status
    FROM bid_attempts WHERE id = ? LIMIT 1`).bind(attemptId).first<{
      id: string;
      normalized_key: string;
      destination_type: string;
      canonical_url: string;
      provisional_title: string;
      provisional_description: string;
      provisional_logo_key: string | null;
      provisional_logo_content_type: string | null;
      state_code: string;
      charge_cents: number;
      stripe_session_id: string | null;
      status: string;
    }>();
  if (!attempt) throw new Error('Checkout attempt not found.');
  if (attempt.stripe_session_id !== session.id || session.currency !== 'usd' || session.amount_total !== attempt.charge_cents) {
    throw new Error('Paid Checkout does not match the immutable attempt.');
  }

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  if (!paymentIntentId) throw new Error('Paid Checkout has no PaymentIntent.');
  let chargeId: string | null = null;
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id ?? null;
  } catch (error) {
    console.warn('StateBid could not expand the Stripe charge ID', { paymentIntentId, error });
  }

  const listingId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const paidAt = event.created * 1000;
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO listings(
        id, normalized_key, destination_type, canonical_url, title, description,
        logo_key, logo_content_type, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`)
      .bind(
        listingId,
        attempt.normalized_key,
        attempt.destination_type,
        attempt.canonical_url,
        attempt.provisional_title,
        attempt.provisional_description,
        attempt.provisional_logo_key,
        attempt.provisional_logo_content_type,
        paidAt,
      ),
    env.DB.prepare(`INSERT OR IGNORE INTO bid_payments(
        id, stripe_event_id, stripe_session_id, stripe_payment_intent_id, stripe_charge_id,
        listing_id, state_code, amount_cents, reversed_cents, paid_at
      ) SELECT ?, ?, ?, ?, ?, id, ?, ?, 0, ? FROM listings WHERE normalized_key = ?`)
      .bind(
        paymentId,
        event.id,
        session.id,
        paymentIntentId,
        chargeId,
        attempt.state_code,
        attempt.charge_cents,
        paidAt,
        attempt.normalized_key,
      ),
    env.DB.prepare(`UPDATE bid_attempts SET status = 'paid' WHERE id = ? AND stripe_session_id = ?
      AND EXISTS (SELECT 1 FROM bid_payments WHERE stripe_session_id = ?)`)
      .bind(attempt.id, session.id, session.id),
  ]);

  const credited = await env.DB.prepare(`SELECT p.id, p.amount_cents, l.logo_key
      FROM bid_payments p JOIN listings l ON l.id = p.listing_id
      WHERE p.stripe_session_id = ? LIMIT 1`).bind(session.id).first<{
        id: string;
        amount_cents: number;
        logo_key: string | null;
      }>();
  if (!credited || credited.amount_cents !== attempt.charge_cents) {
    throw new Error('Checkout was not credited consistently.');
  }

  if (attempt.provisional_logo_key && credited.logo_key !== attempt.provisional_logo_key) {
    await env.FILES.delete(attempt.provisional_logo_key).catch(() => undefined);
  }
}

async function applyReversal(
  event: Stripe.Event,
  charge: Stripe.Charge,
  desiredReversedCents: number,
  reason: string,
) {
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id ?? null;
  const payment = await env.DB.prepare(`SELECT id, amount_cents, reversed_cents FROM bid_payments
      WHERE stripe_charge_id = ? OR (? IS NOT NULL AND stripe_payment_intent_id = ?)
      LIMIT 1`).bind(charge.id, paymentIntentId, paymentIntentId).first<{
        id: string;
        amount_cents: number;
        reversed_cents: number;
      }>();
  if (!payment) throw new Error('The reversal arrived before its verified payment.');
  const desired = Math.max(0, Math.min(payment.amount_cents, desiredReversedCents));
  const adjustment = desired - payment.reversed_cents;
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO payment_reversals(
        id, stripe_event_id, payment_id, adjustment_cents, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), event.id, payment.id, adjustment, reason, event.created * 1000),
    env.DB.prepare(`UPDATE bid_payments SET reversed_cents = ?,
        reversed_at = CASE WHEN ? = 0 THEN reversed_at ELSE ? END,
        stripe_charge_id = COALESCE(stripe_charge_id, ?)
      WHERE id = ? AND NOT EXISTS (
        SELECT 1 FROM payment_reversals WHERE stripe_event_id = ? AND adjustment_cents != ?
      )`).bind(desired, adjustment, event.created * 1000, charge.id, payment.id, event.id, adjustment),
  ]);
}
