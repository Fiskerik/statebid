import Link from 'next/link';

export default function NotFound() {
  return <main className="success-shell"><Link className="wordmark" href="/"><span className="wordmark-icon"><span /></span><span>statebid</span><strong>.lol</strong></Link><section className="success-card"><span className="success-icon error">404</span><h1>That space is not on the map.</h1><p>StateBid contains exactly 50 claimable US states.</p><Link className="primary-button state-cta" href="/">Explore the map</Link></section></main>;
}
