import { env, isAssetStorageConfigured, isDatabaseConfigured } from '@/lib/server/platform';
import { ensureDatabase } from '@/db/runtime';
import { maybeCleanupOperationalData } from '@/lib/server/cleanup';
import { STATE_BY_CODE, US_STATES, type StateCode } from '@/lib/states';
import { ROLLING_DAY_MS } from '@/lib/rolling';
import type {
  ActivityItem,
  BoardSnapshot,
  DailyLeader,
  DestinationType,
  PublicListing,
  StatePosition,
} from '@/lib/types';
import { DEFAULT_STATE_BORDER, DEFAULT_STATE_FILL } from '@/lib/colors';

type PositionRow = {
  state_code: StateCode;
  listing_id: string;
  normalized_key: string;
  destination_type: DestinationType;
  canonical_url: string;
  title: string;
  description: string;
  logo_key: string | null;
  total_cents: number | string;
  daily_cents: number | string | null;
  reached_at: number;
  clicks: number | null;
  state_rank?: number;
  state_border_color?: string | null;
  state_fill_color?: string | null;
};

const TOTALS_CTE = `
  WITH totals AS (
    SELECT p.state_code, p.listing_id,
      SUM(p.amount_cents - p.reversed_cents) AS total_cents,
      MAX(p.paid_at) AS reached_at
    FROM bid_payments p
    GROUP BY p.state_code, p.listing_id
    HAVING SUM(p.amount_cents - p.reversed_cents) > 0
  ), ranked AS (
    SELECT t.*,
      ROW_NUMBER() OVER (
        PARTITION BY t.state_code
        ORDER BY t.total_cents DESC, t.reached_at ASC, t.listing_id ASC
      ) AS state_rank
    FROM totals t
    JOIN listings l ON l.id = t.listing_id AND l.status = 'active'
  )`;

export async function getBoardSnapshot(now = Date.now()): Promise<BoardSnapshot> {
  if (!isDatabaseConfigured()) return withDemoData(emptyBoardSnapshot(now), now);
  await ensureDatabase();
  await maybeCleanupOperationalData(now).catch(() => undefined);
  const cutoff = now - ROLLING_DAY_MS;
  const [positionsResult, bidderResult, dailyResult, activityResult, volumeRow, dailyVolumeRow, visitorRow] = await Promise.all([
    env.DB.prepare(`${TOTALS_CTE},
      daily AS (
        SELECT state_code, listing_id, SUM(amount_cents - reversed_cents) AS daily_cents
        FROM bid_payments
        WHERE paid_at >= ?
        GROUP BY state_code, listing_id
      ), clicks AS (
        SELECT state_code, listing_id, SUM(count) AS clicks
        FROM click_daily
        GROUP BY state_code, listing_id
      )
      SELECT r.state_code, r.listing_id, l.normalized_key, l.destination_type,
        l.canonical_url, l.title, l.description, l.logo_key,
        (SELECT style.state_border_color FROM bid_payments style
          WHERE style.state_code = r.state_code AND style.listing_id = r.listing_id
          ORDER BY style.paid_at ASC, style.id ASC LIMIT 1) AS state_border_color,
        (SELECT style.state_fill_color FROM bid_payments style
          WHERE style.state_code = r.state_code AND style.listing_id = r.listing_id
          ORDER BY style.paid_at ASC, style.id ASC LIMIT 1) AS state_fill_color,
        CAST(r.total_cents AS TEXT) AS total_cents,
        CAST(COALESCE(d.daily_cents, 0) AS TEXT) AS daily_cents,
        r.reached_at, COALESCE(c.clicks, 0) AS clicks
      FROM ranked r
      JOIN listings l ON l.id = r.listing_id
      LEFT JOIN daily d ON d.state_code = r.state_code AND d.listing_id = r.listing_id
      LEFT JOIN clicks c ON c.state_code = r.state_code AND c.listing_id = r.listing_id
      WHERE r.state_rank = 1
      ORDER BY r.total_cents DESC, r.reached_at ASC`).bind(cutoff).all<PositionRow>(),
    env.DB.prepare(`${TOTALS_CTE},
      daily AS (
        SELECT state_code, listing_id, SUM(amount_cents - reversed_cents) AS daily_cents
        FROM bid_payments WHERE paid_at >= ? GROUP BY state_code, listing_id
      ), clicks AS (
        SELECT state_code, listing_id, SUM(count) AS clicks FROM click_daily GROUP BY state_code, listing_id
      )
      SELECT r.state_code, r.listing_id, l.normalized_key, l.destination_type,
        l.canonical_url, l.title, l.description, l.logo_key,
        (SELECT style.state_border_color FROM bid_payments style
          WHERE style.state_code = r.state_code AND style.listing_id = r.listing_id
          ORDER BY style.paid_at ASC, style.id ASC LIMIT 1) AS state_border_color,
        (SELECT style.state_fill_color FROM bid_payments style
          WHERE style.state_code = r.state_code AND style.listing_id = r.listing_id
          ORDER BY style.paid_at ASC, style.id ASC LIMIT 1) AS state_fill_color,
        CAST(r.total_cents AS TEXT) AS total_cents,
        CAST(COALESCE(d.daily_cents, 0) AS TEXT) AS daily_cents,
        r.reached_at, COALESCE(c.clicks, 0) AS clicks, r.state_rank
      FROM ranked r
      JOIN listings l ON l.id = r.listing_id
      LEFT JOIN daily d ON d.state_code = r.state_code AND d.listing_id = r.listing_id
      LEFT JOIN clicks c ON c.state_code = r.state_code AND c.listing_id = r.listing_id
      WHERE r.state_rank <= 3
      ORDER BY r.state_code, r.state_rank`).bind(cutoff).all<PositionRow>(),
    env.DB.prepare(`WITH daily AS (
        SELECT state_code, listing_id,
          SUM(amount_cents - reversed_cents) AS daily_cents,
          MIN(paid_at) AS first_paid_at
        FROM bid_payments
        WHERE paid_at >= ?
        GROUP BY state_code, listing_id
        HAVING SUM(amount_cents - reversed_cents) > 0
      ), totals AS (
        SELECT state_code, listing_id, SUM(amount_cents - reversed_cents) AS total_cents
        FROM bid_payments GROUP BY state_code, listing_id
      )
      SELECT d.state_code, d.listing_id, l.normalized_key, l.destination_type,
        l.canonical_url, l.title, l.description, l.logo_key,
        CAST(d.daily_cents AS TEXT) AS daily_cents,
        CAST(t.total_cents AS TEXT) AS total_cents,
        d.first_paid_at
      FROM daily d
      JOIN totals t ON t.state_code = d.state_code AND t.listing_id = d.listing_id
      JOIN listings l ON l.id = d.listing_id AND l.status = 'active'
      ORDER BY d.daily_cents DESC, d.first_paid_at ASC, d.listing_id ASC
      LIMIT 20`).bind(cutoff).all<PositionRow & { first_paid_at: number }>(),
    env.DB.prepare(`SELECT p.id, p.state_code, p.listing_id,
        (p.amount_cents - p.reversed_cents) AS amount_cents, p.paid_at,
        l.normalized_key, l.destination_type, l.canonical_url, l.title, l.description, l.logo_key
      FROM bid_payments p
      JOIN listings l ON l.id = p.listing_id AND l.status = 'active'
      WHERE p.amount_cents > p.reversed_cents
      ORDER BY p.paid_at DESC, p.id DESC
      LIMIT 12`).all<PositionRow & { id: string; amount_cents: number; paid_at: number }>(),
    env.DB.prepare(`SELECT CAST(COALESCE(SUM(amount_cents - reversed_cents), 0) AS TEXT) AS volume_cents
      FROM bid_payments`).first<{ volume_cents: string }>(),
    env.DB.prepare(`SELECT CAST(COALESCE(SUM(amount_cents - reversed_cents), 0) AS TEXT) AS volume_cents
      FROM bid_payments WHERE paid_at >= ?`).bind(cutoff).first<{ volume_cents: string }>(),
    env.DB.prepare('SELECT COUNT(*) AS visitors FROM site_visitors').first<{ visitors: number | string }>(),
  ]);

  const positions = positionsResult.results.map(positionFromRow);
  const topBidders = emptyTopBidders();
  for (const row of bidderResult.results) {
    topBidders[row.state_code].push(positionFromRow(row));
  }
  const positionByCode = new Map(positions.map((position) => [position.stateCode, position]));
  const dailyLeaders: DailyLeader[] = dailyResult.results.flatMap((row) => {
    const state = STATE_BY_CODE.get(row.state_code);
    if (!state) return [];
    return [{
      stateCode: row.state_code,
      stateName: state.name,
      listing: listingFromRow(row),
      dailyCents: String(row.daily_cents),
      permanentCents: String(row.total_cents),
      paidAt: row.first_paid_at,
    }];
  });
  const activity: ActivityItem[] = activityResult.results.flatMap((row) => {
    const state = STATE_BY_CODE.get(row.state_code);
    if (!state) return [];
    return [{
      id: row.id,
      stateCode: row.state_code,
      stateName: state.name,
      listing: listingFromRow(row),
      amountCents: String(row.amount_cents),
      paidAt: row.paid_at,
    }];
  });
  const mapValue = positions.reduce((total, position) => total + BigInt(position.totalCents), 0n);
  const snapshot: BoardSnapshot = {
    generatedAt: now,
    checkoutEnabled: Boolean(isAssetStorageConfigured() && env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.SITE_URL),
    turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? null,
    states: US_STATES.map((state) => {
      const winner = positionByCode.get(state.code) ?? null;
      return { stateCode: state.code, stateName: state.name, winner, takeoverCents: winner?.takeoverCents ?? '100' };
    }),
    positions,
    topBidders,
    allTimeLeaders: positions,
    dailyLeaders,
    activity,
    stats: {
      mapValueCents: mapValue.toString(),
      verifiedVolumeCents: volumeRow?.volume_cents ?? '0',
      dailyVolumeCents: dailyVolumeRow?.volume_cents ?? '0',
      claimedStates: positions.length,
      visitors: Number(visitorRow?.visitors ?? 0),
    },
  };
  return withDemoData(snapshot, now);
}

export async function getListingByKey(normalizedKey: string) {
  if (!isDatabaseConfigured()) return null;
  await ensureDatabase();
  return env.DB.prepare(`SELECT id, normalized_key, destination_type, canonical_url, title,
      description, logo_key, logo_content_type, status, created_at
    FROM listings WHERE normalized_key = ? LIMIT 1`).bind(normalizedKey).first<{
      id: string;
      normalized_key: string;
      destination_type: DestinationType;
      canonical_url: string;
      title: string;
      description: string;
      logo_key: string | null;
      logo_content_type: string | null;
      status: 'active' | 'suspended';
      created_at: number;
    }>();
}

export async function getListingTotal(normalizedKey: string, stateCode: StateCode) {
  if (!isDatabaseConfigured()) return 0n;
  await ensureDatabase();
  const row = await env.DB.prepare(`SELECT CAST(MAX(COALESCE(SUM(p.amount_cents - p.reversed_cents), 0), 0) AS TEXT) AS total_cents
    FROM bid_payments p JOIN listings l ON l.id = p.listing_id
    WHERE l.normalized_key = ? AND p.state_code = ?`).bind(normalizedKey, stateCode).first<{ total_cents: string }>();
  return BigInt(row?.total_cents ?? '0');
}

export async function getStateLeaderTotal(stateCode: StateCode) {
  if (!isDatabaseConfigured()) return 0n;
  await ensureDatabase();
  const row = await env.DB.prepare(`SELECT CAST(MAX(COALESCE(MAX(total_cents), 0), 0) AS TEXT) AS leader_cents FROM (
      SELECT p.listing_id, SUM(p.amount_cents - p.reversed_cents) AS total_cents
      FROM bid_payments p JOIN listings l ON l.id = p.listing_id AND l.status = 'active'
      WHERE p.state_code = ? GROUP BY p.listing_id
    )`).bind(stateCode).first<{ leader_cents: string }>();
  return BigInt(row?.leader_cents ?? '0');
}

export async function getStateWinner(stateCode: StateCode) {
  if (!isDatabaseConfigured()) return env.DEMO_DATA === 'true' ? demoPositions(Date.now()).find((position) => position.stateCode === stateCode) ?? null : null;
  await ensureDatabase();
  const cutoff = Date.now() - ROLLING_DAY_MS;
  const row = await env.DB.prepare(`${TOTALS_CTE},
    daily AS (
      SELECT state_code, listing_id, SUM(amount_cents - reversed_cents) AS daily_cents
      FROM bid_payments WHERE paid_at >= ? GROUP BY state_code, listing_id
    ), clicks AS (
      SELECT state_code, listing_id, SUM(count) AS clicks FROM click_daily GROUP BY state_code, listing_id
    )
    SELECT r.state_code, r.listing_id, l.normalized_key, l.destination_type,
      l.canonical_url, l.title, l.description, l.logo_key,
      (SELECT style.state_border_color FROM bid_payments style
        WHERE style.state_code = r.state_code AND style.listing_id = r.listing_id
        ORDER BY style.paid_at ASC, style.id ASC LIMIT 1) AS state_border_color,
      (SELECT style.state_fill_color FROM bid_payments style
        WHERE style.state_code = r.state_code AND style.listing_id = r.listing_id
        ORDER BY style.paid_at ASC, style.id ASC LIMIT 1) AS state_fill_color,
      CAST(r.total_cents AS TEXT) AS total_cents,
      CAST(COALESCE(d.daily_cents, 0) AS TEXT) AS daily_cents,
      r.reached_at, COALESCE(c.clicks, 0) AS clicks
    FROM ranked r JOIN listings l ON l.id = r.listing_id
    LEFT JOIN daily d ON d.state_code = r.state_code AND d.listing_id = r.listing_id
    LEFT JOIN clicks c ON c.state_code = r.state_code AND c.listing_id = r.listing_id
    WHERE r.state_code = ? AND r.state_rank = 1 LIMIT 1`).bind(cutoff, stateCode).first<PositionRow>();
  return row ? positionFromRow(row) : env.DEMO_DATA === 'true' ? demoPositions(Date.now()).find((position) => position.stateCode === stateCode) ?? null : null;
}

export async function getCheckoutResult(sessionId: string) {
  if (!isDatabaseConfigured()) return null;
  await ensureDatabase();
  return env.DB.prepare(`SELECT a.id AS attempt_id, a.state_code, a.target_total_cents,
      a.charge_cents, a.status, a.normalized_key, l.id AS listing_id, l.title,
      l.destination_type, l.canonical_url, l.description, l.logo_key,
      CAST(COALESCE((SELECT SUM(p.amount_cents - p.reversed_cents)
        FROM bid_payments p WHERE p.listing_id = l.id AND p.state_code = a.state_code), 0) AS TEXT) AS listing_total_cents
    FROM bid_attempts a
    LEFT JOIN listings l ON l.normalized_key = a.normalized_key
    WHERE a.stripe_session_id = ? LIMIT 1`).bind(sessionId).first<{
      attempt_id: string;
      state_code: StateCode;
      target_total_cents: number;
      charge_cents: number;
      status: string;
      normalized_key: string;
      listing_id: string | null;
      title: string | null;
      destination_type: DestinationType;
      canonical_url: string | null;
      description: string | null;
      logo_key: string | null;
      listing_total_cents: string;
    }>();
}

function emptyBoardSnapshot(now: number): BoardSnapshot {
  return {
    generatedAt: now,
    checkoutEnabled: false,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? null,
    states: US_STATES.map((state) => ({
      stateCode: state.code,
      stateName: state.name,
      winner: null,
      takeoverCents: '100',
    })),
    positions: [],
    topBidders: emptyTopBidders(),
    allTimeLeaders: [],
    dailyLeaders: [],
    activity: [],
    stats: {
      mapValueCents: '0',
      verifiedVolumeCents: '0',
      dailyVolumeCents: '0',
      claimedStates: 0,
      visitors: 0,
    },
  };
}

function listingFromRow(row: PositionRow): PublicListing {
  return {
    id: row.listing_id,
    normalizedKey: row.normalized_key,
    destinationType: row.destination_type,
    canonicalUrl: row.canonical_url,
    title: row.title,
    description: row.description,
    logoUrl: row.logo_key ? `/assets/${row.logo_key}` : null,
  };
}

function positionFromRow(row: PositionRow): StatePosition {
  const state = STATE_BY_CODE.get(row.state_code)!;
  const total = BigInt(String(row.total_cents));
  return {
    stateCode: row.state_code,
    stateName: state.name,
    listing: listingFromRow(row),
    totalCents: total.toString(),
    dailyCents: String(row.daily_cents ?? 0),
    clicks: Number(row.clicks ?? 0),
    takeoverCents: (total + 100n).toString(),
    reachedAt: row.reached_at,
    stateBorderColor: row.state_border_color ?? DEFAULT_STATE_BORDER,
    stateFillColor: row.state_fill_color ?? DEFAULT_STATE_FILL,
  };
}

function emptyTopBidders(): Record<StateCode, StatePosition[]> {
  return Object.fromEntries(US_STATES.map((state) => [state.code, []])) as unknown as Record<StateCode, StatePosition[]>;
}

/** Preview-only fixture; it never writes fake payments to the ledger. */
function withDemoData(snapshot: BoardSnapshot, now: number): BoardSnapshot {
  if (env.DEMO_DATA !== 'true' || snapshot.positions.length > 0) return snapshot;
  const positions = demoPositions(now);
  const topBidders = emptyTopBidders();
  for (const position of positions) topBidders[position.stateCode].push(position);
  const dailyLeaders: DailyLeader[] = positions.map((position) => ({
    stateCode: position.stateCode,
    stateName: position.stateName,
    listing: position.listing,
    dailyCents: position.dailyCents,
    permanentCents: position.totalCents,
    paidAt: position.reachedAt,
  }));
  const activity: ActivityItem[] = positions.map((position, index) => ({
    id: `demo-payment-${index}`,
    stateCode: position.stateCode,
    stateName: position.stateName,
    listing: position.listing,
    amountCents: '100',
    paidAt: position.reachedAt,
  }));
  const positionByCode = new Map(positions.map((position) => [position.stateCode, position]));
  return {
    ...snapshot,
    checkoutEnabled: false,
    states: US_STATES.map((state) => {
      const winner = positionByCode.get(state.code) ?? null;
      return { stateCode: state.code, stateName: state.name, winner, takeoverCents: winner?.takeoverCents ?? '100' };
    }),
    positions,
    topBidders,
    allTimeLeaders: positions,
    dailyLeaders,
    activity,
    stats: { mapValueCents: '200', verifiedVolumeCents: '200', dailyVolumeCents: '200', claimedStates: 2, visitors: snapshot.stats.visitors },
  };
}

function demoPositions(now: number): StatePosition[] {
  const listing: PublicListing = {
    id: 'demo-papuli88',
    normalizedKey: 'x:papuli88',
    destinationType: 'x',
    canonicalUrl: 'https://x.com/papuli88',
    title: 'Papuli (@papuli88) on X',
    description: 'Preview listing for the StateBid launch.',
    logoUrl: 'https://unavatar.io/x/papuli88',
  };
  return (['CA', 'TX'] as const).map((stateCode) => {
    const state = STATE_BY_CODE.get(stateCode)!;
    return {
      stateCode,
      stateName: state.name,
      listing,
      totalCents: '100',
      dailyCents: '100',
      clicks: 0,
      takeoverCents: '200',
      reachedAt: now - 60_000,
      stateBorderColor: DEFAULT_STATE_BORDER,
      stateFillColor: DEFAULT_STATE_FILL,
    };
  });
}
