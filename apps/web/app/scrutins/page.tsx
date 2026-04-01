import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Scrutins publics',
  description:
    'Tous les scrutins publics de l\'Assemblée nationale et du Sénat. Résultats des votes, détail par groupe politique et par parlementaire sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/scrutins`,
  },
  openGraph: {
    title: 'Scrutins publics — Assemblée nationale et Sénat',
    description:
      'Résultats des votes parlementaires. Filtrez par date, sujet ou résultat.',
  },
};

export default function ScrutinsPage() {
  return <PageClient />;
}
