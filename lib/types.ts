import type { StateCode } from './states';

export type DestinationType = 'website' | 'x';
export type MoneyCents = string;

export type PublicListing = {
  id: string;
  normalizedKey: string;
  destinationType: DestinationType;
  canonicalUrl: string;
  title: string;
  description: string;
  logoUrl: string | null;
};

export type StatePosition = {
  stateCode: StateCode;
  stateName: string;
  listing: PublicListing;
  totalCents: MoneyCents;
  dailyCents: MoneyCents;
  clicks: number;
  takeoverCents: MoneyCents;
  reachedAt: number;
};

export type DailyLeader = {
  stateCode: StateCode;
  stateName: string;
  listing: PublicListing;
  dailyCents: MoneyCents;
  permanentCents: MoneyCents;
  paidAt: number;
};

export type ActivityItem = {
  id: string;
  stateCode: StateCode;
  stateName: string;
  listing: PublicListing;
  amountCents: MoneyCents;
  paidAt: number;
};

export type BoardSnapshot = {
  generatedAt: number;
  checkoutEnabled: boolean;
  turnstileSiteKey: string | null;
  positions: StatePosition[];
  allTimeLeaders: StatePosition[];
  dailyLeaders: DailyLeader[];
  activity: ActivityItem[];
  stats: {
    mapValueCents: MoneyCents;
    verifiedVolumeCents: MoneyCents;
    dailyVolumeCents: MoneyCents;
    claimedStates: number;
  };
};

export type ListingPreview = {
  existing: boolean;
  listing: PublicListing;
  previewId: string | null;
};

export type CheckoutQuote = {
  attemptId: string;
  stateCode: StateCode;
  listingKey: string;
  targetTotalCents: MoneyCents;
  existingTotalCents: MoneyCents;
  leaderTotalCents: MoneyCents;
  chargeCents: MoneyCents;
  expiresAt: number;
  checkoutUrl: string;
};

export type CheckoutStatus = {
  status: 'pending' | 'paid' | 'failed' | 'expired';
  stateCode: StateCode;
  stateName: string;
  listing: PublicListing | null;
  listingTotalCents: MoneyCents;
  creditedCents: MoneyCents;
  isWinner: boolean;
  winner: StatePosition | null;
  nextTargetCents: MoneyCents;
};
