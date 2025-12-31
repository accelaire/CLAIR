import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CLAIR - Transparence Politique',
  description: 'Plateforme citoyenne de transparence politique. Analysez les votes des députés, le lobbying et les promesses électorales.',
  keywords: ['politique', 'france', 'députés', 'votes', 'assemblée nationale', 'lobbying', 'transparence'],
  authors: [{ name: 'CLAIR' }],
  openGraph: {
    title: 'CLAIR - Transparence Politique',
    description: 'Analysez les votes des députés et le lobbying en France',
    type: 'website',
    locale: 'fr_FR',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background antialiased`}>
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
