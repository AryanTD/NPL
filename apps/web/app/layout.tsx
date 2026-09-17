import type { Metadata } from 'next';
import Link from 'next/link';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'NPL Auction',
  description: 'Nepal Premier League fantasy auction game',
};

const FOOTER_LINKS = [
  { label: 'Players', href: '/players' },
  { label: 'More Information', href: '/info' },
  { label: 'Terms & Conditions', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Cookie Policy', href: '/cookies' },
];

function Footer() {
  return (
    <footer
      style={{
        width: '100%',
        borderTop: '1px solid var(--border)',
        padding: '14px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 20px',
        justifyContent: 'center',
      }}
    >
      {FOOTER_LINKS.map(({ label, href }) => (
        <Link
          key={href}
          href={href}
          style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}
        >
          {label}
        </Link>
      ))}
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Providers>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="antialiased">
          {children}
          <Footer />
        </body>
      </html>
    </Providers>
  );
}
