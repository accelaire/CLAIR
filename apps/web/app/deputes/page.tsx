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
import PageClient, { type DeputesResponse } from './PageClient';

// Rendu à la demande : sans ça, le HTML servi n'est que le squelette de
// chargement. Motif et contreparties détaillés dans `lib/liste-ssr`.
export const dynamic = 'force-dynamic';

const CHEMIN = '/deputes';

/** Clés de filtre que le `PageClient` lit dans l'URL. */
const FILTRES = [
  'search',
  'groupe',
  'legislature',
] as const;

const METADATA: Metadata = {
  title: 'Députés',
  description:
    'Liste des 577 députés de l\'Assemblée nationale. Recherchez par nom, groupe politique ou département. Votes, présence et activité sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}${CHEMIN}`,
  },
  openGraph: {
    title: 'Députés — Assemblée nationale',
    description:
      'Tous les députés de la 17e législature. Filtrez par groupe, département ou activité.',
  },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: ParametresUrl;
}): Promise<Metadata> {
  return metadonneesListe(METADATA, CHEMIN, pageListe(searchParams, FILTRES));
}

export default async function DeputesPage({
  searchParams,
}: {
  searchParams: ParametresUrl;
}) {
  const page = pageListe(searchParams, FILTRES);

  const initialDeputes = await fetchFromApi<DeputesResponse>(
    `${CHEMIN}?page=${page ?? 1}&limit=24`,
    REVALIDATE_LISTE_S,
  );

  // Au-delà de la dernière page, l'API répond une liste vide en 200. La rendre
  // ouvrirait un espace explorable sans fond, où chaque `?page=` supplémentaire
  // est une URL de plus à explorer pour rien.
  if (page !== null && page > 1 && initialDeputes?.data.length === 0) notFound();

  return (
    <>
      <PageClient initialDeputes={initialDeputes ?? undefined} initialPage={page ?? 1} />
      {page !== null && initialDeputes && (
        <div className="container mx-auto px-4 pb-8">
          <Pagination
            basePath={CHEMIN}
            currentPage={page}
            totalPages={initialDeputes.meta.totalPages}
          />
        </div>
      )}
    </>
  );
}
