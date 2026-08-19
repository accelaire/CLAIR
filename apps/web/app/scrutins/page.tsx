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
import PageClient, { type ScrutinsResponse } from './PageClient';

// Rendu à la demande : sans ça, le HTML servi n'est que le squelette de
// chargement. Motif et contreparties détaillés dans `lib/liste-ssr`.
export const dynamic = 'force-dynamic';

const CHEMIN = '/scrutins';

/** Clés de filtre que le `PageClient` lit dans l'URL. */
const FILTRES = [
  'search',
  'chambre',
  'type',
  'tag',
  'dateFrom',
  'dateTo',
] as const;

const METADATA: Metadata = {
  title: 'Votes — Assemblée nationale et Sénat',
  description:
    'Tous les votes et scrutins publics de l\'Assemblée nationale et du Sénat. Résultats, détail par groupe politique et par parlementaire sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}${CHEMIN}`,
  },
  openGraph: {
    title: 'Votes Assemblée nationale et Sénat — Scrutins publics',
    description:
      'Résultats des votes parlementaires. Filtrez par date, sujet ou résultat.',
  },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: ParametresUrl;
}): Promise<Metadata> {
  return metadonneesListe(METADATA, CHEMIN, pageListe(searchParams, FILTRES));
}

export default async function ScrutinsPage({
  searchParams,
}: {
  searchParams: ParametresUrl;
}) {
  const page = pageListe(searchParams, FILTRES);

  const initialScrutins = await fetchFromApi<ScrutinsResponse>(
    `${CHEMIN}?page=${page ?? 1}&limit=20`,
    REVALIDATE_LISTE_S,
  );

  // Au-delà de la dernière page, l'API répond une liste vide en 200. La rendre
  // ouvrirait un espace explorable sans fond, où chaque `?page=` supplémentaire
  // est une URL de plus à explorer pour rien.
  if (page !== null && page > 1 && initialScrutins?.data.length === 0) notFound();

  return (
    <>
      <PageClient
        initialScrutins={initialScrutins ?? undefined}
        initialPage={page ?? 1}
      />
      {page !== null && initialScrutins && (
        <div className="container mx-auto px-4 pb-8">
          <Pagination
            basePath={CHEMIN}
            currentPage={page}
            totalPages={initialScrutins.meta.totalPages}
          />
        </div>
      )}
    </>
  );
}
