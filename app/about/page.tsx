import type { Metadata } from 'next';
import { env } from '@/lib/server/platform';
import { LegalPage } from '@/app/components/legal-page';

export const metadata: Metadata = { title: 'About', description: 'Why StateBid turns the US map into a transparent attention market.' };

export default function AboutPage() {
  const support = env.SUPPORT_EMAIL ?? 'support@statebid.lol';
  return <LegalPage eyebrow="About StateBid" title="A map where attention has a visible price." intro="StateBid is a transparent paid-placement marketplace: fifty claimable states, one current leader on each, and no hidden ranking algorithm.">
    <h2>The idea</h2><p>Every US state is a distinct advertising space. A verified payment adds permanently to one listing’s standing total for that state. The highest active total receives the logo placement until another listing moves ahead.</p>
    <h2>What makes it different</h2><p>The permanent board shows who leads each state. The rolling 24-hour board shows where money has moved recently. Both come from the same verified payment ledger, so there is no separate popularity score to game.</p>
    <h2>Built for clarity</h2><p>StateBid has no bidder accounts, bidder dashboard, application email list, or X OAuth. Stripe hosts payment collection. Public listing identity locks after its first successful payment so later supporters cannot rewrite it.</p>
    <h2>Paid placement, not endorsement</h2><p>A logo on the map is sponsored advertising purchased through the bidding mechanic. StateBid does not recommend, verify, or endorse a listed organization, product, or claim. Suspended placements fall back automatically to the next-highest active standing bid.</p>
    <h2>Contact</h2><p>Questions, security reports, and takedown requests can be sent to <a href={`mailto:${support}`}>{support}</a>.</p>
  </LegalPage>;
}
