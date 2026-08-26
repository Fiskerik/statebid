import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StateBid — Claim a piece of America',
  description:
    'A live attention market where the highest verified bid owns each state on the map.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
