import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { REVALIDATE_LISTE_S } from '@/lib/liste-ssr';
import PageClient, { type LobbyistesResponse } from './PageClient';

// Rendu à la demande : sans ça, le HTML servi n'est que le squelette de
// chargement. Motif et contreparties détaillés dans `lib/liste-ssr`.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lobbying',
  description:
    'Organisations de lobbying déclarées auprès de la HATVP. Budget, secteurs d\'activité et actions de représentation d\'intérêts sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/lobbying`,
  },
  openGraph: {
    title: 'Lobbying — Données HATVP',
    description:
      'Explorez les organisations de lobbying. Filtrez par budget, secteur ou type.',
  },
};

export default async function LobbyingPage() {
  const initialLobbyistes = await fetchFromApi<LobbyistesResponse>(
    '/lobbying?page=1&limit=20&sort=nom&order=asc',
    REVALIDATE_LISTE_S,
  );

  return <PageClient initialLobbyistes={initialLobbyistes ?? undefined} />;
}
