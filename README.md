# StateBid.lol

StateBid is a map-led paid-placement marketplace for the 50 US states. Each verified Stripe payment permanently increases one listing's standing total on one state; the highest active total owns the visible logo placement. The same payment also appears on the rolling previous-24-hour board.

## Stack

- TypeScript, React, Vinext, and the OpenAI Sites runtime
- Cloudflare D1 for the immutable payment ledger and derived rankings
- Cloudflare R2 for cached listing logos
- Stripe-hosted Checkout for ordinary USD payments (no Connect)
- Platform authentication for the operator-only `/admin` route
- Public-domain Census-derived state geometry through `us-atlas`

## Local setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

The public map runs without payment credentials and clearly disables Checkout. Keep Stripe test mode enabled until every required launch item in `docs/launch-runbook.md` is complete.

Useful checks:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Public interfaces

- `GET /api/board` — five-second, ETag-aware snapshot with all 50 states, permanent winners, rolling leaders, activity, and string-serialized cents
- `POST /api/listing-preview` — normalized immutable listing or safe first-time preview
- `POST /api/logo-upload` — temporary first-listing image only
- `POST /api/checkout` — server-revalidated quote and Stripe-hosted Checkout URL
- `POST /api/stripe/webhook` — raw-body signature verification and idempotent fulfillment/reversals
- `GET /api/checkout/status` — informational success-page status
- `GET /go/:stateCode` — current-owner redirect and anonymous daily click deduplication
- `GET /api/health` — configuration and storage readiness without revealing secrets

The success return never fulfills a bid. Only the signed Stripe webhook writes to `bid_payments`.

## Data and migrations

The authoritative schema is in `db/schema.ts`; the initial migration is in `drizzle/`. `db/runtime.ts` also creates missing tables so a fresh Sites D1 binding can serve its first request safely. Money is stored as SQLite 64-bit integer cents and crosses public APIs as decimal strings.

## Live deployment gate

The current codebase is designed to be deployed privately for acceptance testing. Do not enable live Checkout until the operator identity and address, support contact, tax/VAT treatment, Stripe Tax settings, webhook destination, Radar/3DS policy, admin identity allowlist, Turnstile keys, domain ownership, and legally reviewed Terms and Privacy Notice are configured.
