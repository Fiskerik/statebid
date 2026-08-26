import type { Metadata } from 'next';
import { env } from '@/lib/server/platform';
import { LegalPage } from '@/app/components/legal-page';

export const metadata: Metadata = { title: 'Terms', description: 'Terms for purchasing StateBid paid placements.' };

export default function TermsPage() {
  const operator = env.OPERATOR_NAME ?? '[Swedish operator entity — configure before launch]';
  const address = env.OPERATOR_ADDRESS ?? '[Registered address — configure before launch]';
  const support = env.SUPPORT_EMAIL ?? 'support@statebid.lol';
  return <LegalPage eyebrow="Terms · Draft for legal review" title="Terms of placement." intro="Effective 26 August 2026. Live payments must remain disabled until the operator identity, tax setup, and legally reviewed terms are configured.">
    <h2>1. Operator and service</h2><p>StateBid is operated by {operator}, {address} (“StateBid”, “we”). StateBid sells visibly ranked digital advertising placements on an interactive US map. Contact: <a href={`mailto:${support}`}>{support}</a>.</p>
    <h2>2. Eligibility and authority</h2><p>You must be legally able to enter this agreement and must have authority to promote the submitted destination and use its name, description, and logo. You may not impersonate another person or brand, infringe rights, or place a bid for an unauthorized listing.</p>
    <h2>3. Immediate digital performance</h2><p>By completing Checkout, you expressly request immediate digital-service performance after payment confirmation. The verified increment is applied without delay. Where consumer withdrawal rights apply, you acknowledge that immediate performance may affect or end that right to the extent permitted by applicable law. This clause requires jurisdiction-specific legal review before launch.</p>
    <h2>4. Payment and standing credit</h2><p>Stripe processes USD payments. Your new target, existing standing credit, and amount charged now are shown before redirecting to Stripe. StateBid itself does not collect card details. A payment creates standing credit under the public Rules; it does not buy permanent map ownership or a fixed display period.</p>
    <h2>5. Outbidding and finality</h2><p>Another listing may move ahead at any time, including while Checkout is open. Ordinary outbidding is not grounds for a refund. Successful payments are final except for duplicate payments, reversals, legally required refunds, or exceptions StateBid approves. Refunds, disputes, and chargebacks reduce the associated standing credit.</p>
    <h2>6. No traffic or commercial guarantee</h2><p>StateBid does not promise impressions, clicks, conversions, exclusivity outside the selected state, search ranking, or any commercial result. Public click counts are privacy-conscious estimates and may undercount or exclude suspicious traffic.</p>
    <h2>7. Prohibited placements</h2><p>You may not promote malware, phishing, deceptive tracking links, link shorteners, adult content, chat invites, unlawful content, regulated or prohibited offers, hate or harassment, intellectual-property infringement, or content that creates material risk to users or StateBid. StateBid may expand operational blocklists to protect the service.</p>
    <h2>8. Immutable identity</h2><p>The first verified payment for a normalized destination locks the public listing identity for this version. Later supporters cannot edit it. You are responsible for reviewing the preview before payment. Cached images may remain even if the external destination later changes.</p>
    <h2>9. Moderation and takedowns</h2><p>We may reject a preview, suspend a listing, block a destination, remove unsafe assets, or cooperate with valid legal requests. Suspension removes the listing from active rankings and reveals the next active standing bid; it does not automatically create a refund. Submit reports or takedown notices to <a href={`mailto:${support}`}>{support}</a>.</p>
    <h2>10. Taxes and receipts</h2><p>Stripe may collect billing information and calculate tax according to configured Stripe Tax settings. Prices and tax treatment shown in Checkout control the transaction. You are responsible for taxes or reporting obligations not collected by StateBid.</p>
    <h2>11. Availability and liability</h2><p>The service is provided on an “as available” basis. To the maximum extent permitted by law, StateBid is not liable for indirect or consequential losses, external destination content, ranking interruptions, or lost expected traffic. Nothing excludes liability that cannot legally be excluded.</p>
    <h2>12. Governing terms</h2><p>Swedish law governs these Terms, subject to mandatory consumer protections and applicable dispute-resolution rights. If a provision is unenforceable, the remainder continues. Material changes apply prospectively and will be dated on this page.</p>
  </LegalPage>;
}
