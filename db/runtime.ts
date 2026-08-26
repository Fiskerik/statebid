import { env, isDatabaseConfigured } from '@/lib/server/platform';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY NOT NULL,
    normalized_key TEXT NOT NULL,
    destination_type TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    logo_key TEXT,
    logo_content_type TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_normalized_key ON listings(normalized_key)`,
  `CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status)`,
  `CREATE TABLE IF NOT EXISTS bid_attempts (
    id TEXT PRIMARY KEY NOT NULL,
    normalized_key TEXT NOT NULL,
    destination_type TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    provisional_title TEXT NOT NULL,
    provisional_description TEXT NOT NULL DEFAULT '',
    provisional_logo_key TEXT,
    provisional_logo_content_type TEXT,
    state_code TEXT NOT NULL,
    target_total_cents INTEGER NOT NULL,
    existing_total_cents INTEGER NOT NULL,
    charge_cents INTEGER NOT NULL,
    stripe_session_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_bid_attempts_stripe_session ON bid_attempts(stripe_session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bid_attempts_key_state ON bid_attempts(normalized_key, state_code)`,
  `CREATE INDEX IF NOT EXISTS idx_bid_attempts_expires ON bid_attempts(expires_at)`,
  `CREATE TABLE IF NOT EXISTS listing_previews (
    id TEXT PRIMARY KEY NOT NULL,
    normalized_key TEXT NOT NULL,
    destination_type TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    logo_key TEXT,
    logo_content_type TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_listing_previews_key ON listing_previews(normalized_key)`,
  `CREATE INDEX IF NOT EXISTS idx_listing_previews_expires ON listing_previews(expires_at)`,
  `CREATE TABLE IF NOT EXISTS bid_payments (
    id TEXT PRIMARY KEY NOT NULL,
    stripe_event_id TEXT NOT NULL,
    stripe_session_id TEXT NOT NULL,
    stripe_payment_intent_id TEXT,
    stripe_charge_id TEXT,
    listing_id TEXT NOT NULL REFERENCES listings(id),
    state_code TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    reversed_cents INTEGER NOT NULL DEFAULT 0,
    paid_at INTEGER NOT NULL,
    reversed_at INTEGER
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_bid_payments_event ON bid_payments(stripe_event_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_bid_payments_session ON bid_payments(stripe_session_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_bid_payments_intent ON bid_payments(stripe_payment_intent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bid_payments_state_listing ON bid_payments(state_code, listing_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bid_payments_paid_at ON bid_payments(paid_at)`,
  `CREATE TABLE IF NOT EXISTS payment_reversals (
    id TEXT PRIMARY KEY NOT NULL,
    stripe_event_id TEXT NOT NULL,
    payment_id TEXT NOT NULL REFERENCES bid_payments(id),
    adjustment_cents INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_reversals_event ON payment_reversals(stripe_event_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payment_reversals_payment ON payment_reversals(payment_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    processed_at INTEGER,
    error TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status, received_at)`,
  `CREATE TABLE IF NOT EXISTS click_events (
    id TEXT PRIMARY KEY NOT NULL,
    listing_id TEXT NOT NULL REFERENCES listings(id),
    state_code TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    day TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_click_events_daily_unique ON click_events(listing_id, state_code, visitor_hash, day)`,
  `CREATE INDEX IF NOT EXISTS idx_click_events_listing_state ON click_events(listing_id, state_code)`,
  `CREATE INDEX IF NOT EXISTS idx_click_events_created ON click_events(created_at)`,
  `CREATE TABLE IF NOT EXISTS click_daily (
    listing_id TEXT NOT NULL REFERENCES listings(id),
    state_code TEXT NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_click_daily_unique ON click_daily(listing_id, state_code, day)`,
  `CREATE INDEX IF NOT EXISTS idx_click_daily_listing_state ON click_daily(listing_id, state_code)`,
  `CREATE TABLE IF NOT EXISTS moderation_events (
    id TEXT PRIMARY KEY NOT NULL,
    listing_id TEXT NOT NULL REFERENCES listings(id),
    admin_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_moderation_listing ON moderation_events(listing_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS blocklist (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    value TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_blocklist_kind_value ON blocklist(kind, value)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY NOT NULL,
    count INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at)`,
  `CREATE TABLE IF NOT EXISTS content_reports (
    id TEXT PRIMARY KEY NOT NULL,
    listing_id TEXT NOT NULL REFERENCES listings(id),
    state_code TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL,
    resolved_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_content_reports_listing ON content_reports(listing_id, created_at)`,
] as const;

let initialization: { key: string; promise: Promise<void> } | null = null;

export async function ensureDatabase() {
  // Public/setup deployments intentionally work without persistence. Callers
  // can use isDatabaseConfigured() to render an empty/setup experience.
  if (!isDatabaseConfigured()) return;
  const key = `${env.TURSO_DATABASE_URL ?? ''}\u0000${env.TURSO_AUTH_TOKEN ?? ''}`;
  if (!initialization || initialization.key !== key) {
    const promise = (async () => {
      await env.DB.batch(SCHEMA_STATEMENTS.map((statement) => env.DB.prepare(statement)));
    })().catch((error) => {
      if (initialization?.key === key) initialization = null;
      throw error;
    });
    initialization = { key, promise };
  }
  await initialization.promise;
}

export function getRawDb() {
  return env.DB;
}
