import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import { Metadata } from 'next';
import { protoMono } from '../styles/fonts';
import clsx from 'clsx';
import Providers from './Providers';

const APP_URL = process.env.NEXT_PUBLIC_URL?.replace(/\/+$/, '') ?? 'https://app.livmore.life';

export const metadata: Metadata = {
  title: 'LivMore',
  description: 'Turn healthy habits into rewards',
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: 'website',
    url: APP_URL,
    title: 'LivMore',
    description: 'Turn healthy habits into rewards',
    images: [{ url: '/newHero.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LivMore',
    description: 'Turn healthy habits into rewards',
    images: ['/newHero.png'],
  },
  other: {
    'base:app_id': '6980f8191672d70694e29334',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={clsx('antialiased bg-slate-900', protoMono.variable)}>
        <Providers>
          <div className="font-mono dark">
            {children}
            <Analytics />
          </div>
        </Providers>
      </body>
    </html>
  );
}
