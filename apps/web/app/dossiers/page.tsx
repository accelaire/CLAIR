import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { REVALIDATE_LISTE_S } from '@/lib/liste-ssr';
import PageClient, { type DossiersResponse } from './PageClient';

// Rendu à la demande : sans ça, le HTML servi n'est que le squelette de
// chargement. Motif et contreparties détaillés dans `lib/liste-ssr`.
export const dynamic = 'force-dynamic';

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

export default async function DossiersPage() {
  const initialDossiers = await fetchFromApi<DossiersResponse>(
    '/dossiers?page=1&limit=20',
    REVALIDATE_LISTE_S,
  );

  return <PageClient initialDossiers={initialDossiers ?? undefined} />;
}
