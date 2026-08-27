import type { Metadata } from 'next';
import { env } from '@/lib/server/platform';
import { LegalPage } from '@/app/components/legal-page';

export const metadata: Metadata = { title: 'Privacy', description: 'How StateBid handles public listing, payment-reference, click, and operational data.' };

export default function PrivacyPage() {
  const operator = env.OPERATOR_NAME ?? '[Swedish operator entity — configure before launch]';
  const address = env.OPERATOR_ADDRESS ?? '[Registered address — configure before launch]';
  const support = env.SUPPORT_EMAIL ?? 'support@statebid.lol';
  const rawClickDays = env.PRIVACY_RETENTION_DAYS ?? '30';
  return <LegalPage eyebrow="Privacy · Draft for legal review" title="Small data footprint. Clear public data." intro="StateBid has no bidder accounts and does not collect a bidder email inside the application. Stripe may collect billing and receipt details within hosted Checkout.">
    <h2>1. Controller</h2><p>{operator}, {address}, is the controller for StateBid application data. Privacy requests: <a href={`mailto:${support}`}>{support}</a>.</p>
    <h2>2. Public listing data</h2><p>We publish the normalized website or X destination, cached title, description, logo, state standing totals, verified activity, and aggregate click count. This data is necessary to provide the paid-placement marketplace and remains public while the service and legal record-keeping needs continue.</p>
    <h2>3. Payment data</h2><p>StateBid stores internal bid attempts, amounts, timestamps, state and listing references, and Stripe Session, PaymentIntent, Charge, refund, and dispute identifiers. We do not receive or store complete card numbers. Stripe independently processes Checkout information under its own privacy terms.</p>
    <h2>4. Anonymous click measurement</h2><p>When a visitor follows a sponsor link, StateBid sets a random first-party visitor cookie and stores a salted one-way hash scoped to the visitor, listing, state, and UTC day. It counts at most one click per combination per day. The cookie does not contain a name, email, or listing preference.</p>
    <h2>5. Lifetime visitor count</h2><p>When the public map loads, StateBid uses the same random first-party visitor cookie to maintain a salted one-way hash and increment an aggregate lifetime visitor count. It does not store the cookie value itself, IP address, name, email, or browsing history for this statistic.</p>
    <h2>6. Analytics and security</h2><p>StateBid uses Vercel Web Analytics for aggregate page-view and site-usage reporting. We also process short-lived IP and browser signals for rate limits, abuse prevention, Turnstile checks, webhook logs, error monitoring, moderation records, and operator-authentication audit. Public reports can be submitted without an account or email. The analytics configuration and processor terms should be confirmed during legal review.</p>
    <h2>7. Retention</h2><ul><li>Temporary listing previews and unused uploads expire after one hour and are removed through automated cleanup.</li><li>Abandoned bid attempts are retained for up to 30 days for reconciliation and then removed or minimized.</li><li>Raw deduplicated click events are retained for {rawClickDays} days; non-identifying daily aggregates may be kept longer for public statistics.</li><li>Security and ordinary error logs are retained for up to 90 days unless an incident requires longer investigation.</li><li>Verified payment, reversal, moderation, and accounting records are retained for the service lifetime and any longer period required by applicable law.</li></ul>
    <h2>8. Processors and transfers</h2><p>Vercel provides application hosting, delivery, logo object storage, and Web Analytics. Turso provides the hosted libSQL database. Stripe provides payment processing, fraud tools, receipts, and optional tax services. Cloudflare Turnstile may provide abuse prevention when enabled. These providers may process data internationally using their contractual transfer mechanisms. Exact entities and regional settings must be documented before live launch.</p>
    <h2>9. Legal bases</h2><p>We process transaction and placement data to perform the agreement; fraud, security, measurement, and moderation data for legitimate interests; records to meet legal obligations; and optional technologies on consent where applicable.</p>
    <h2>10. Your rights</h2><p>Depending on the GDPR and local law, you may request access, correction, erasure, restriction, portability, or object to processing, and may complain to the Swedish Authority for Privacy Protection (IMY). Public listing immutability does not override mandatory privacy rights; requests are assessed against legal and transactional record obligations.</p>
    <h2>11. No sale of personal data</h2><p>StateBid does not sell bidder or visitor personal data and does not use application data to build cross-site advertising profiles.</p>
  </LegalPage>;
}
