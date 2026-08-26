import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://statebid.lol'),
  title: { default: 'StateBid — Own a piece of the map', template: '%s · StateBid' },
  description: 'Fifty states. Permanent standing bids. The highest verified bidder puts their logo on the map.',
  applicationName: 'StateBid',
  keywords: ['state bidding', 'claim a state', 'US map advertising', 'paid placement', 'online billboard', 'StateBid'],
  authors: [{ name: 'StateBid' }],
  creator: 'StateBid',
  publisher: 'StateBid',
  category: 'business',
  manifest: '/manifest.webmanifest',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website', url: '/', siteName: 'StateBid', title: 'StateBid — Own a piece of the map',
    description: 'Claim one of 50 states with a permanent verified standing bid.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'StateBid map of the United States' }],
  },
  twitter: { card: 'summary_large_image', title: 'StateBid — Own a piece of the map', description: 'Claim one of 50 states with a permanent verified standing bid.', images: ['/og.png'] },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f3f1eb' }, { media: '(prefers-color-scheme: dark)', color: '#0d0f0d' }] };

const themeScript = `(function(){try{var s=localStorage.getItem('statebid-theme');var d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='dark'}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'StateBid',
    url: 'https://statebid.lol',
    description: 'Claim one of 50 US states with a permanent verified advertising bid.',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '1', priceCurrency: 'USD', description: 'Starting bid for an unclaimed state.' },
  };
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />{children}</body>
    </html>
  );
}
