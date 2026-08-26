import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const listings = sqliteTable(
  'listings',
  {
    id: text('id').primaryKey(),
    normalizedKey: text('normalized_key').notNull(),
    destinationType: text('destination_type', { enum: ['website', 'x'] }).notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    logoKey: text('logo_key'),
    logoContentType: text('logo_content_type'),
    status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_listings_normalized_key').on(table.normalizedKey),
    index('idx_listings_status').on(table.status),
  ],
);

export const bidAttempts = sqliteTable(
  'bid_attempts',
  {
    id: text('id').primaryKey(),
    normalizedKey: text('normalized_key').notNull(),
    destinationType: text('destination_type', { enum: ['website', 'x'] }).notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    provisionalTitle: text('provisional_title').notNull(),
    provisionalDescription: text('provisional_description').notNull().default(''),
    provisionalLogoKey: text('provisional_logo_key'),
    provisionalLogoContentType: text('provisional_logo_content_type'),
    stateCode: text('state_code').notNull(),
    targetTotalCents: integer('target_total_cents').notNull(),
    existingTotalCents: integer('existing_total_cents').notNull(),
    chargeCents: integer('charge_cents').notNull(),
    stripeSessionId: text('stripe_session_id'),
    status: text('status', { enum: ['pending', 'paid', 'failed', 'expired'] }).notNull().default('pending'),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_bid_attempts_stripe_session').on(table.stripeSessionId),
    index('idx_bid_attempts_key_state').on(table.normalizedKey, table.stateCode),
    index('idx_bid_attempts_expires').on(table.expiresAt),
  ],
);

export const listingPreviews = sqliteTable(
  'listing_previews',
  {
    id: text('id').primaryKey(),
    normalizedKey: text('normalized_key').notNull(),
    destinationType: text('destination_type', { enum: ['website', 'x'] }).notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    logoKey: text('logo_key'),
    logoContentType: text('logo_content_type'),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [
    index('idx_listing_previews_key').on(table.normalizedKey),
    index('idx_listing_previews_expires').on(table.expiresAt),
  ],
);

export const bidPayments = sqliteTable(
  'bid_payments',
  {
    id: text('id').primaryKey(),
    stripeEventId: text('stripe_event_id').notNull(),
    stripeSessionId: text('stripe_session_id').notNull(),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeChargeId: text('stripe_charge_id'),
    listingId: text('listing_id').notNull().references(() => listings.id),
    stateCode: text('state_code').notNull(),
    amountCents: integer('amount_cents').notNull(),
    reversedCents: integer('reversed_cents').notNull().default(0),
    paidAt: integer('paid_at').notNull(),
    reversedAt: integer('reversed_at'),
  },
  (table) => [
    uniqueIndex('idx_bid_payments_event').on(table.stripeEventId),
    uniqueIndex('idx_bid_payments_session').on(table.stripeSessionId),
    uniqueIndex('idx_bid_payments_intent').on(table.stripePaymentIntentId),
    uniqueIndex('idx_bid_payments_charge').on(table.stripeChargeId),
    index('idx_bid_payments_state_listing').on(table.stateCode, table.listingId),
    index('idx_bid_payments_paid_at').on(table.paidAt),
  ],
);

export const paymentReversals = sqliteTable(
  'payment_reversals',
  {
    id: text('id').primaryKey(),
    stripeEventId: text('stripe_event_id').notNull(),
    paymentId: text('payment_id').notNull().references(() => bidPayments.id),
    adjustmentCents: integer('adjustment_cents').notNull(),
    reason: text('reason').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_payment_reversals_event').on(table.stripeEventId),
    index('idx_payment_reversals_payment').on(table.paymentId, table.createdAt),
  ],
);

export const webhookEvents = sqliteTable(
  'webhook_events',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    status: text('status', { enum: ['received', 'processed', 'failed'] }).notNull(),
    receivedAt: integer('received_at').notNull(),
    processedAt: integer('processed_at'),
    error: text('error'),
  },
  (table) => [index('idx_webhook_events_status').on(table.status, table.receivedAt)],
);

export const clickEvents = sqliteTable(
  'click_events',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull().references(() => listings.id),
    stateCode: text('state_code').notNull(),
    visitorHash: text('visitor_hash').notNull(),
    day: text('day').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_click_events_daily_unique').on(
      table.listingId,
      table.stateCode,
      table.visitorHash,
      table.day,
    ),
    index('idx_click_events_listing_state').on(table.listingId, table.stateCode),
    index('idx_click_events_created').on(table.createdAt),
  ],
);

export const moderationEvents = sqliteTable(
  'moderation_events',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull().references(() => listings.id),
    adminUserId: text('admin_user_id').notNull(),
    action: text('action').notNull(),
    reason: text('reason').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_moderation_listing').on(table.listingId, table.createdAt)],
);

export const blocklist = sqliteTable(
  'blocklist',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['destination', 'host', 'handle'] }).notNull(),
    value: text('value').notNull(),
    reason: text('reason').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [uniqueIndex('idx_blocklist_kind_value').on(table.kind, table.value)],
);

export const rateLimits = sqliteTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull(),
    resetAt: integer('reset_at').notNull(),
  },
  (table) => [index('idx_rate_limits_reset').on(table.resetAt)],
);

export const contentReports = sqliteTable(
  'content_reports',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull().references(() => listings.id),
    stateCode: text('state_code').notNull(),
    reason: text('reason').notNull(),
    details: text('details').notNull().default(''),
    status: text('status', { enum: ['open', 'resolved'] }).notNull().default('open'),
    createdAt: integer('created_at').notNull(),
    resolvedAt: integer('resolved_at'),
  },
  (table) => [
    index('idx_content_reports_status').on(table.status, table.createdAt),
    index('idx_content_reports_listing').on(table.listingId, table.createdAt),
  ],
);
