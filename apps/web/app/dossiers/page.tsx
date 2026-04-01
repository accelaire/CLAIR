import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Dossiers législatifs',
  description:
    'Tous les dossiers législatifs en cours et passés à l\'Assemblée nationale et au Sénat. Scrutins, amendements et débats sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/dossiers`,
  },
  openGraph: {
    title: 'Dossiers législatifs',
    description:
      'Suivez les projets et propositions de loi. Filtrez par état, chambre ou sujet.',
  },
};

export default function DossiersPage() {
  return <PageClient />;
}
