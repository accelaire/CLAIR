import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchFromApi } from '@/lib/api-server';
import {
  REVALIDATE_LISTE_S,
  metadonneesListe,
  pageListe,
  type ParametresUrl,
} from '@/lib/liste-ssr';
import { Pagination } from '@/components/Pagination';
import PageClient, { type LobbyistesResponse } from './PageClient';

// Rendu à la demande : sans ça, le HTML servi n'est que le squelette de
// chargement. Motif et contreparties détaillés dans `lib/liste-ssr`.
export const dynamic = 'force-dynamic';

const CHEMIN = '/lobbying';

/** Clés de filtre que le `PageClient` lit dans l'URL. */
const FILTRES = [
  'search',
  'type',
  'secteurs',
  'sort',
  'order',
] as const;

const METADATA: Metadata = {
  title: 'Lobbying',
  description:
    'Organisations de lobbying déclarées auprès de la HATVP. Budget, secteurs d\'activité et actions de représentation d\'intérêts sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}${CHEMIN}`,
  },
  openGraph: {
    title: 'Lobbying — Données HATVP',
    description:
      'Explorez les organisations de lobbying. Filtrez par budget, secteur ou type.',
  },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: ParametresUrl;
}): Promise<Metadata> {
  return metadonneesListe(METADATA, CHEMIN, pageListe(searchParams, FILTRES));
}

export default async function LobbyingPage({
  searchParams,
}: {
  searchParams: ParametresUrl;
}) {
  const page = pageListe(searchParams, FILTRES);

  const initialLobbyistes = await fetchFromApi<LobbyistesResponse>(
    `${CHEMIN}?page=${page ?? 1}&limit=20&sort=nom&order=asc`,
    REVALIDATE_LISTE_S,
  );

  // Au-delà de la dernière page, l'API répond une liste vide en 200. La rendre
  // ouvrirait un espace explorable sans fond, où chaque `?page=` supplémentaire
  // est une URL de plus à explorer pour rien.
  if (page !== null && page > 1 && initialLobbyistes?.data.length === 0) notFound();

  return (
    <>
      <PageClient initialLobbyistes={initialLobbyistes ?? undefined} initialPage={page ?? 1} />
      {page !== null && initialLobbyistes && (
        <div className="container mx-auto px-4 pb-8">
          <Pagination
            basePath={CHEMIN}
            currentPage={page}
            totalPages={initialLobbyistes.meta.totalPages}
          />
        </div>
      )}
    </>
  );
}
