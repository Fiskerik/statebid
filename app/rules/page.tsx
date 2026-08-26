import type { Metadata } from 'next';
import { LegalPage } from '@/app/components/legal-page';

export const metadata: Metadata = { title: 'Rules', description: 'The permanent and rolling-24-hour StateBid bidding rules.' };

export default function RulesPage() {
  return <LegalPage eyebrow="Marketplace rules" title="Transparent by design." intro="These are the public mechanics used to calculate the map, the permanent board, and the rolling previous 24 hours.">
    <h2>1. Fifty claimable states</h2><p>The map includes the 50 US states. Washington, DC and US territories are not claimable.</p>
    <h2>2. Standing bids are permanent</h2><p>A new state starts at $1. Bids use whole US-dollar totals. Every verified payment increment permanently credits the chosen listing and state, subject only to reversals, disputes, legally required refunds, duplicate-payment corrections, or an operator-approved exception.</p>
    <h2>3. The leader is the highest active total</h2><p>For each state, verified payment increments are summed by listing. The active listing with the highest cumulative total appears on the map. Equal totals favor the listing that reached that total first. Suspended listings are excluded, revealing the next-highest active standing bid.</p>
    <h2>4. Challengers move at least $1 ahead</h2><p>A target must be at least $1 above the current leader. A current leader may strengthen its own position by at least $1. One Stripe Checkout may charge no more than $999,999, while a listing can build a larger cumulative total through later raises.</p>
    <h2>5. Returning listings pay the difference</h2><p>A listing is keyed globally by its normalized website URL or X handle. If that listing already has $200 credited on a state and targets $350, Checkout charges $150. The same listing can bid independently on several states.</p>
    <h2>6. Checkout races preserve both payments</h2><p>The quote is calculated immediately before Stripe Checkout opens. If another verified payment changes the state during Checkout, a later completed payment still adds to that listing’s permanent standing total. The success page shows whether it won and the next public target if it did not.</p>
    <h2>7. Only Stripe webhooks count</h2><p>A browser return, screenshot, pending card authorization, or abandoned Checkout does not affect rankings. StateBid credits a bid only after a signed Stripe event confirms a paid Checkout. Duplicate events are ignored.</p>
    <h2>8. The 24-hour board uses the same payments</h2><p>The rolling board groups net verified payment increments by listing and state over the previous 24 hours. An increment leaves only that board when it becomes older than 24 hours; it remains in the permanent total.</p>
    <h2>9. Listing identity locks on first payment</h2><p>The first successful payment for a normalized destination locks its title, description, destination, and cached logo for this version. A racing first-time Checkout that finishes later credits the already-locked listing and cannot replace its identity.</p>
    <h2>10. Placement is moderated advertising</h2><p>Destinations and uploads must follow the Terms. StateBid may block, suspend, or remove unsafe or prohibited placements. Placement is paid advertising and not an endorsement or traffic guarantee.</p>
  </LegalPage>;
}
