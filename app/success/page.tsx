import type { Metadata } from 'next';
import { SuccessStatus } from '@/app/components/success-status';

export const metadata: Metadata = { title: 'Payment status', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const sessionId = (await searchParams).session_id ?? '';
  return <SuccessStatus sessionId={sessionId} />;
}
