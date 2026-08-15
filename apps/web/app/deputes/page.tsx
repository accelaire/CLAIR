import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { REVALIDATE_LISTE_S } from '@/lib/liste-ssr';
import PageClient, { type DeputesResponse } from './PageClient';

// Rendu à la demande : sans ça, le HTML servi n'est que le squelette de
// chargement. Motif et contreparties détaillés dans `lib/liste-ssr`.
export const dynamic = 'force-dynamic';

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

export default async function DeputesPage() {
  const initialDeputes = await fetchFromApi<DeputesResponse>(
    '/deputes?page=1&limit=24',
    REVALIDATE_LISTE_S,
  );

  return <PageClient initialDeputes={initialDeputes ?? undefined} />;
}
