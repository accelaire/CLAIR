import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Députés',
  description:
    'Liste des 577 députés de l\'Assemblée nationale. Recherchez par nom, groupe politique ou département. Votes, présence et activité sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/deputes`,
  },
  openGraph: {
    title: 'Députés — Assemblée nationale',
    description:
      'Tous les députés de la 17e législature. Filtrez par groupe, département ou activité.',
  },
};

export default function DeputesPage() {
  return <PageClient />;
}
