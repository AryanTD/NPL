import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'NPL Auction',
  description: 'Nepal Premier League fantasy auction game',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
