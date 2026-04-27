import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Votes — Assemblée nationale et Sénat',
  description:
    'Tous les votes et scrutins publics de l\'Assemblée nationale et du Sénat. Résultats, détail par groupe politique et par parlementaire sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/scrutins`,
  },
  openGraph: {
    title: 'Votes Assemblée nationale et Sénat — Scrutins publics',
    description:
      'Résultats des votes parlementaires. Filtrez par date, sujet ou résultat.',
  },
};

export default function ScrutinsPage() {
  return <PageClient />;
}
