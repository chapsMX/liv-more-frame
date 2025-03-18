import clsx from 'clsx';
import type { Metadata } from 'next';
import { protoMono } from '../styles/fonts';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
export const metadata: Metadata = {
  title: "Liv More",
  description: "Turn Healty Habitos Into Rewards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={clsx('antialiased bg-slate-900', protoMono.variable)}>
        <div className="font-mono dark">
          {children}
          <Analytics />
        </div>
      </body>
    </html>
  );
}
