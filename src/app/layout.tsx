import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import { UserProvider } from '../context/UserContext';
import { Metadata } from 'next';
import { protoMono } from '../styles/fonts';
import clsx from 'clsx';

export const metadata: Metadata = {
  title: 'LivMore',
  description: 'Turn healthy habits into rewards',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <html lang="en">
        <body className={clsx('antialiased bg-slate-900', protoMono.variable)}>
          <div className="font-mono dark">
            {children}
            <Analytics />
          </div>
        </body>
      </html>
    </UserProvider>
  );
}
