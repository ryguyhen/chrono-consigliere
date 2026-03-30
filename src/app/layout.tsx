// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { DM_Mono } from 'next/font/google';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { Nav } from '@/components/layout/Nav';
import { Providers } from '@/components/layout/Providers';
import './globals.css';

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-dm-mono',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Chrono Consigliere — Watch what your friends are into',
  description: 'Live inventory from the world\'s best dealers. See what your circle is saving and what\'s worth a look.',
  openGraph: {
    title: 'Chrono Consigliere',
    description: 'See what your friends are into.',
    type: 'website',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className={dmMono.variable}>
      <body className="bg-cream text-ink font-sans antialiased">
        <Providers>
          <Nav session={session} />
          <main className="pb-14 md:pb-0">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
