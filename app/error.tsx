'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="success-shell"><section className="success-card"><span className="success-icon error">!</span><h1>The map missed an update.</h1><p>Your payment records are authoritative and unaffected. Retry this view or come back shortly.</p><button className="primary-button state-cta" onClick={reset}>Retry</button></section></main>;
}
