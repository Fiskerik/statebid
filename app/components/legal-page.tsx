import type { ReactNode } from 'react';
import Link from 'next/link';

export function LegalPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return <main className="legal-shell">
    <header className="legal-header"><Link className="wordmark" href="/"><span className="wordmark-icon"><span /></span><span>statebid</span><strong>.lol</strong></Link><nav><a href="/about">About</a><a href="/rules">Rules</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></nav></header>
    <section className="legal-hero"><span className="eyebrow"><span /> {eyebrow}</span><h1>{title}</h1><p>{intro}</p></section>
    <article className="legal-content">{children}</article>
    <footer><div className="wordmark footer-mark"><span className="wordmark-icon"><span /></span><span>statebid</span><strong>.lol</strong></div><p>Paid advertising, visibly ranked. Placement is not endorsement.</p><nav><Link href="/">Map</Link><a href="/rules">Rules</a><a href="/privacy">Privacy</a></nav></footer>
  </main>;
}
