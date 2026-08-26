import { env } from 'cloudflare:workers';
import Stripe from 'stripe';
import { HttpError } from './security';

export function getStripe() {
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(503, 'Stripe Checkout is not configured yet.');
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
}

export function getSiteUrl() {
  if (!env.SITE_URL) throw new HttpError(503, 'The production site URL is not configured yet.');
  const url = new URL(env.SITE_URL);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new HttpError(503, 'The configured site URL must use HTTPS.');
  }
  return url.origin;
}
