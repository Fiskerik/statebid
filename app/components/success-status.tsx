'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, LoaderCircle, Share2, Trophy } from 'lucide-react';
import type { CheckoutStatus } from '@/lib/types';

export function SuccessStatus({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [error, setError] = useState<string | null>(sessionId ? null : 'This return link has no Checkout Session ID.');
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false; let timer: number | undefined; let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
        const payload = await response.json() as CheckoutStatus & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Could not verify payment status.');
        if (cancelled) return;
        setStatus(payload);
        if (payload.status === 'pending' && attempts < 30) timer = window.setTimeout(poll, 2000);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not verify payment status.');
      }
    };
    poll();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [sessionId]);

  const xIntent = useMemo(() => {
    if (!status?.listing || status.status !== 'paid') return null;
    const text = status.isWinner
      ? `I just claimed ${status.stateName} on StateBid for ${money(status.listingTotalCents)}. Can you outbid me?`
      : `I just added ${money(status.creditedCents)} to ${status.listing.title} on ${status.stateName} at StateBid.`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`https://statebid.lol/state/${status.stateCode.toLowerCase()}`)}`;
  }, [status]);

  return <main className="success-shell"><Link className="wordmark" href="/"><span className="wordmark-icon"><span /></span><span>statebid</span><strong>.lol</strong></Link><section className="success-card">
    {error ? <><span className="success-icon error">!</span><h1>We could not read this status.</h1><p>{error}</p><Link className="primary-button state-cta" href="/"><ArrowLeft size={15} /> Return to the map</Link></> : !status || status.status === 'pending' ? <><LoaderCircle className="success-loader spin" size={34} /><h1>Waiting for Stripe.</h1><p>Your browser return is informational. The map changes only after StateBid receives Stripe’s signed paid webhook.</p></> : status.status !== 'paid' ? <><span className="success-icon error">!</span><h1>No bid was recorded.</h1><p>This Checkout is {status.status}. A failed or expired attempt never changes the map.</p><Link className="primary-button state-cta" href={`/?state=${status.stateCode}#map`}>Try again</Link></> : <><span className="success-icon"><Check size={26} /></span><span className="state-card-kicker">Verified payment · {status.stateName}</span><h1>{status.isWinner ? 'You moved the map.' : 'Your standing bid is in.'}</h1><p>{status.listing?.title} now has <strong>{money(status.listingTotalCents)}</strong> permanently credited on {status.stateName}.</p>{status.isWinner ? <div className="success-result won"><Trophy size={18} /><span><strong>Current leader</strong><small>Your locked logo is live on {status.stateName}.</small></span></div> : <div className="success-result"><span><strong>The state moved during Checkout.</strong><small>Your payment still counted. The current public target is {money(status.nextTargetCents)}.</small></span></div>}{xIntent ? <a className="claim-button" href={xIntent} target="_blank" rel="noopener noreferrer"><Share2 size={15} /> Share on X</a> : null}<Link className="text-button" href={`/state/${status.stateCode.toLowerCase()}`}>View the public state page</Link></>}
  </section></main>;
}

function money(cents: string) { const dollars = BigInt(cents) / 100n; return `$${dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`; }
