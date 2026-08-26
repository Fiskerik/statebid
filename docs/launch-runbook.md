# StateBid launch runbook

## 1. Ownership and legal gate

- Confirm and purchase `statebid.lol`; the working name in code is not registrar confirmation.
- Configure `OPERATOR_NAME`, `OPERATOR_ADDRESS`, `OPERATOR_COUNTRY`, and `SUPPORT_EMAIL`.
- Obtain Swedish/EU legal review of `/terms` and `/privacy`, including immediate digital performance, consumer eligibility, withdrawal rights, dispute handling, tax/VAT, retention, and international processor transfers.
- Publish a support and takedown mailbox that is actively monitored.
- Keep `STRIPE_SECRET_KEY` in test mode until this section is signed off.

## 2. Stripe test-mode setup

- Use ordinary Stripe Payments. Do not enable Connect or third-party payouts.
- Configure card Checkout with supported wallets, billing details, receipts, Radar, and the chosen 3DS policy.
- Decide and configure Stripe Tax; set `STRIPE_TAX_ENABLED=true` only after tax registrations and product treatment are reviewed.
- Add the webhook endpoint `https://<test-host>/api/stripe/webhook` and subscribe to:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `charge.refunded`
  - charge dispute lifecycle events
- Store the endpoint signing secret as `STRIPE_WEBHOOK_SECRET`.
- Exercise first claims, repeat-listing raises, same listing on another state, retries, concurrent stale Checkouts, partial/full refunds, dispute open/won/lost, and failed/expired sessions.
- Confirm the success page reports a paid-but-not-winning race without refunding or losing either payment.

## 3. Vercel data services and application security

- Create a Turso database and configure `TURSO_DATABASE_URL` plus `TURSO_AUTH_TOKEN` in the Vercel Preview and Production environments.
- Create a private Vercel Blob store and verify `BLOB_READ_WRITE_TOKEN` is injected into new deployments.
- Configure long, unique `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` values. Confirm `/admin` rejects an absent or invalid signed session.
- Configure a random `RATE_LIMIT_SALT` and Cloudflare Turnstile keys.
- Review destination/content blocklists, abuse thresholds, Blob retention behavior, and `/admin` moderation fallbacks.
- Assets should be served through `/assets/*` with immutable caching, `nosniff`, and restrictive CSP headers.

## 4. Monitoring and reconciliation

- Alert on non-2xx responses from `/api/stripe/webhook`, failed `webhook_events`, and a `/api/health` status other than `ready`.
- Create Vercel log/observability alerts for uncaught function exceptions and sustained 5xx rates.
- In `/admin`, reconcile recent payment rows with their Stripe PaymentIntent/Session IDs and investigate paid attempts that lack a ledger entry.
- Review open content reports and suspended listings daily during launch.
- Treat Stripe Dashboard payment status as the payment-system record and the libSQL ledger as the ranking record; never edit verified payment rows manually.

## 5. Backups and recovery

- Export the Turso/libSQL database before a release and on a scheduled operational cadence using the provider's supported backup/export tooling.

- Store exports encrypted with restricted operator access and test a restore into a separate test database.
- Configure an equivalent backup/retention policy for permanent Vercel Blob logo keys.
- Never restore only rankings: restore the payment/reversal ledger and recompute winners from it.

## 6. Production acceptance

- Exactly 50 claimable states; no DC or territories.
- Mouse, keyboard, screen-reader labels, and touch work for every state, including Alaska/Hawaii and northeastern callouts.
- Permanent and rolling rankings match test fixtures; ties favor the first listing to reach the total.
- Webhook retries do not duplicate credit and suspensions reveal the next active standing bid.
- Board changes are visible within ten seconds and the five-second ETag cache returns 304 for an unchanged bucket.
- Dark/light preference persists; reduced motion, empty, loading, and error states are usable.
- Legal pages contain final operator details; no placeholder text remains.
- The production build, private test deployment, and a final live-mode $1 end-to-end transaction all pass before public access is enabled.
