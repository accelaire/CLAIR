import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Sujets',
  description:
    'Sujets politiques et thématiques suivis sur CLAIR.vote. Dossiers législatifs, scrutins et débats classés par thème.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/sujets`,
  },
  openGraph: {
    title: 'Sujets politiques',
    description:
      'Explorez les sujets politiques : santé, économie, environnement, sécurité et plus.',
  },
};

export default function SujetsPage() {
  return <PageClient />;
}
