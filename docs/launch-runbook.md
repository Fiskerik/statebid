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

## 3. Cloudflare and application security

- Configure D1 as `DB`, R2 as `FILES`, a random `RATE_LIMIT_SALT`, and Cloudflare Turnstile keys.
- Configure `ADMIN_USER_IDS` with stable platform user IDs; use email only as a temporary secondary allowlist.
- Restrict Sites access to the operator during acceptance. Verify production strips and replaces spoofed `oai-authenticated-user-*` headers.
- Review destination/content blocklists, abuse thresholds, R2 lifecycle behavior, and `/admin` moderation fallbacks.
- Verify the R2 bucket is not directly public; assets should be served only through `/assets/*` with nosniff/CSP headers.

## 4. Monitoring and reconciliation

- Alert on non-2xx responses from `/api/stripe/webhook`, failed `webhook_events`, and a `/api/health` status other than `ready`.
- Create Cloudflare log alerts for uncaught Worker exceptions and sustained 5xx rates.
- In `/admin`, reconcile recent payment rows with their Stripe PaymentIntent/Session IDs and investigate paid attempts that lack a ledger entry.
- Review open content reports and suspended listings daily during launch.
- Treat Stripe Dashboard payment status as the payment-system record and the D1 ledger as the ranking record; never edit verified payment rows manually.

## 5. Backups and recovery

- Export D1 before a release and on a scheduled operational cadence:

  ```bash
  npx wrangler d1 export <database-name> --remote --output statebid-YYYY-MM-DD.sql
  ```

- Store exports encrypted with restricted operator access and test a restore into a separate test database.
- Enable R2 object versioning or an equivalent backup policy for permanent logo keys.
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
