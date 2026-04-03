import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Groupes politiques',
  description:
    'Groupes politiques de l\'Assemblée nationale et du Sénat. Membres, votes et positions politiques sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/groupes`,
  },
  openGraph: {
    title: 'Groupes politiques — Assemblée nationale et Sénat',
    description:
      'Explorez les groupes parlementaires, leurs membres et leurs votes.',
  },
};

export default function GroupesPage() {
  return <PageClient />;
}
