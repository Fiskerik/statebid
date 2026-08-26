CREATE TABLE `bid_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_key` text NOT NULL,
	`destination_type` text NOT NULL,
	`canonical_url` text NOT NULL,
	`provisional_title` text NOT NULL,
	`provisional_description` text DEFAULT '' NOT NULL,
	`provisional_logo_key` text,
	`provisional_logo_content_type` text,
	`state_code` text NOT NULL,
	`target_total_cents` integer NOT NULL,
	`existing_total_cents` integer NOT NULL,
	`charge_cents` integer NOT NULL,
	`stripe_session_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bid_attempts_stripe_session` ON `bid_attempts` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `idx_bid_attempts_key_state` ON `bid_attempts` (`normalized_key`,`state_code`);--> statement-breakpoint
CREATE INDEX `idx_bid_attempts_expires` ON `bid_attempts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `bid_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`stripe_event_id` text NOT NULL,
	`stripe_session_id` text NOT NULL,
	`stripe_payment_intent_id` text,
	`stripe_charge_id` text,
	`listing_id` text NOT NULL,
	`state_code` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`reversed_cents` integer DEFAULT 0 NOT NULL,
	`paid_at` integer NOT NULL,
	`reversed_at` integer,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bid_payments_event` ON `bid_payments` (`stripe_event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bid_payments_session` ON `bid_payments` (`stripe_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bid_payments_intent` ON `bid_payments` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bid_payments_charge` ON `bid_payments` (`stripe_charge_id`);--> statement-breakpoint
CREATE INDEX `idx_bid_payments_state_listing` ON `bid_payments` (`state_code`,`listing_id`);--> statement-breakpoint
CREATE INDEX `idx_bid_payments_paid_at` ON `bid_payments` (`paid_at`);--> statement-breakpoint
CREATE TABLE `blocklist` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blocklist_kind_value` ON `blocklist` (`kind`,`value`);--> statement-breakpoint
CREATE TABLE `click_daily` (
	`listing_id` text NOT NULL,
	`state_code` text NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_click_daily_unique` ON `click_daily` (`listing_id`,`state_code`,`day`);--> statement-breakpoint
CREATE INDEX `idx_click_daily_listing_state` ON `click_daily` (`listing_id`,`state_code`);--> statement-breakpoint
CREATE TABLE `click_events` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`state_code` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`day` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_click_events_daily_unique` ON `click_events` (`listing_id`,`state_code`,`visitor_hash`,`day`);--> statement-breakpoint
CREATE INDEX `idx_click_events_listing_state` ON `click_events` (`listing_id`,`state_code`);--> statement-breakpoint
CREATE INDEX `idx_click_events_created` ON `click_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `content_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`state_code` text NOT NULL,
	`reason` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_content_reports_status` ON `content_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_content_reports_listing` ON `content_reports` (`listing_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `listing_previews` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_key` text NOT NULL,
	`destination_type` text NOT NULL,
	`canonical_url` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`logo_key` text,
	`logo_content_type` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_listing_previews_key` ON `listing_previews` (`normalized_key`);--> statement-breakpoint
CREATE INDEX `idx_listing_previews_expires` ON `listing_previews` (`expires_at`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_key` text NOT NULL,
	`destination_type` text NOT NULL,
	`canonical_url` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`logo_key` text,
	`logo_content_type` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_listings_normalized_key` ON `listings` (`normalized_key`);--> statement-breakpoint
CREATE INDEX `idx_listings_status` ON `listings` (`status`);--> statement-breakpoint
CREATE TABLE `moderation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`admin_user_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_moderation_listing` ON `moderation_events` (`listing_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `payment_reversals` (
	`id` text PRIMARY KEY NOT NULL,
	`stripe_event_id` text NOT NULL,
	`payment_id` text NOT NULL,
	`adjustment_cents` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `bid_payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payment_reversals_event` ON `payment_reversals` (`stripe_event_id`);--> statement-breakpoint
CREATE INDEX `idx_payment_reversals_payment` ON `payment_reversals` (`payment_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_reset` ON `rate_limits` (`reset_at`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`received_at` integer NOT NULL,
	`processed_at` integer,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `idx_webhook_events_status` ON `webhook_events` (`status`,`received_at`);