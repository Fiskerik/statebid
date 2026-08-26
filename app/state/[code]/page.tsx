import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, ExternalLink, Share2 } from 'lucide-react';
import { ReportForm } from '@/app/components/report-form';
import { getStateWinner } from '@/lib/server/board';
import { STATE_BY_CODE, type StateCode } from '@/lib/states';
/* eslint-disable @next/next/no-img-element */

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = (await params).code.toUpperCase() as StateCode;
  const state = STATE_BY_CODE.get(code);
  if (!state) return { title: 'State not found' };
  const winner = await getStateWinner(code);
  const title = winner ? `${winner.listing.title} leads ${state.name} at ${money(winner.totalCents)}` : `${state.name} is open for $1`;
  const description = winner ? `See the permanent leader and rolling activity for ${state.name} on StateBid.` : `Be the first verified bidder to put a logo on ${state.name}.`;
  const images = winner?.listing.logoUrl ? [{ url: winner.listing.logoUrl, alt: winner.listing.title }] : ['/og.png'];
  return { title, description, alternates: { canonical: `/state/${code.toLowerCase()}` }, openGraph: { title, description, images }, twitter: { card: 'summary_large_image', title, description, images: images.map((image) => typeof image === 'string' ? image : image.url) } };
}

export default async function StatePage({ params }: Props) {
  const code = (await params).code.toUpperCase() as StateCode;
  const state = STATE_BY_CODE.get(code);
  if (!state) notFound();
  const winner = await getStateWinner(code);
  const shareText = winner ? `${winner.listing.title} leads ${state.name} on StateBid at ${money(winner.totalCents)}. Can you outbid them?` : `${state.name} is still open on StateBid for $1.`;
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(`https://statebid.lol/state/${code.toLowerCase()}`)}`;
  return <main className="state-page-shell"><header className="legal-header"><Link className="wordmark" href="/"><span className="wordmark-icon"><span /></span><span>statebid</span><strong>.lol</strong></Link><Link className="back-link" href="/#map"><ArrowLeft size={14} /> Back to map</Link></header>
    <section className="state-page-hero"><div><span className="eyebrow"><span /> State ownership page</span><span className="state-code-giant">{code}</span><h1>{state.name}</h1><p>{winner ? 'Current permanent leader' : 'This state is available now'}</p></div>
      <article className="state-owner-card">{winner ? <><div className="owner-logo-large" style={{ background: color(winner.listing.normalizedKey) }}>{winner.listing.logoUrl ? <img src={winner.listing.logoUrl} alt={`${winner.listing.title} logo`} /> : winner.listing.title.slice(0, 2).toUpperCase()}</div><span className="state-card-kicker">Paid placement · Current leader</span><h2>{winner.listing.title}</h2><p>{winner.listing.description || winner.listing.canonicalUrl}</p><dl><div><dt>Permanent total</dt><dd>{money(winner.totalCents)}</dd></div><div><dt>Last 24 hours</dt><dd>{money(winner.dailyCents)}</dd></div><div><dt>Measured clicks</dt><dd>{winner.clicks.toLocaleString()}</dd></div><div><dt>Takeover price</dt><dd>{money(winner.takeoverCents)}</dd></div></dl><a className="claim-button" href={`/go/${code}`} target="_blank" rel="sponsored nofollow noopener">Visit sponsor <ExternalLink size={15} /></a><ReportForm listingId={winner.listing.id} stateCode={code} /></> : <><span className="state-card-kicker">Unclaimed · Opens at $1</span><h2>First dollar wins.</h2><p>The first signed, verified payment puts its locked listing identity on {state.name}.</p></>}
        <a className="primary-button state-cta" href={`/?state=${code}#map`}>{winner ? `Claim for ${money(winner.takeoverCents)}` : `Claim ${state.name} for $1`} <ArrowUpRight size={16} /></a><a className="share-button" href={intent} target="_blank" rel="noopener noreferrer"><Share2 size={14} /> Share on X</a>
      </article>
    </section>
    <section className="state-explainer"><p>Every verified payment counts toward this state’s permanent standing total and the rolling previous 24 hours. Placement is paid advertising, not endorsement.</p><a href="/rules">Read the full rules</a></section>
  </main>;
}

function money(cents: string) { const dollars = BigInt(cents) / 100n; return `$${dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`; }
function color(key: string) { let hash = 0; for (const character of key) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0; return ['#ff785a', '#c8ff62', '#7ee7ff', '#c4a7ff', '#ffd25f', '#82f1c8'][Math.abs(hash) % 6]; }
