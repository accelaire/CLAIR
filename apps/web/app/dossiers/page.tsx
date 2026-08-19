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
import PageClient, { type DossiersResponse } from './PageClient';

// Rendu à la demande : sans ça, le HTML servi n'est que le squelette de
// chargement. Motif et contreparties détaillés dans `lib/liste-ssr`.
export const dynamic = 'force-dynamic';

const CHEMIN = '/dossiers';

/** Clés de filtre que le `PageClient` lit dans l'URL. */
const FILTRES = [
  'search',
  'etat',
  'chambre',
  'procedureCode',
  'procedureLibelle',
  'dateFrom',
  'dateTo',
] as const;

const METADATA: Metadata = {
  title: 'Dossiers législatifs',
  description:
    'Tous les dossiers législatifs en cours et passés à l\'Assemblée nationale et au Sénat. Scrutins, amendements et débats sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}${CHEMIN}`,
  },
  openGraph: {
    title: 'Dossiers législatifs',
    description:
      'Suivez les projets et propositions de loi. Filtrez par état, chambre ou sujet.',
  },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: ParametresUrl;
}): Promise<Metadata> {
  return metadonneesListe(METADATA, CHEMIN, pageListe(searchParams, FILTRES));
}

export default async function DossiersPage({
  searchParams,
}: {
  searchParams: ParametresUrl;
}) {
  const page = pageListe(searchParams, FILTRES);

  const initialDossiers = await fetchFromApi<DossiersResponse>(
    `${CHEMIN}?page=${page ?? 1}&limit=20`,
    REVALIDATE_LISTE_S,
  );

  // Au-delà de la dernière page, l'API répond une liste vide en 200. La rendre
  // ouvrirait un espace explorable sans fond, où chaque `?page=` supplémentaire
  // est une URL de plus à explorer pour rien.
  if (page !== null && page > 1 && initialDossiers?.data.length === 0) notFound();

  return (
    <>
      <PageClient initialDossiers={initialDossiers ?? undefined} initialPage={page ?? 1} />
      {page !== null && initialDossiers && (
        <div className="container mx-auto px-4 pb-8">
          <Pagination
            basePath={CHEMIN}
            currentPage={page}
            totalPages={initialDossiers.meta.totalPages}
          />
        </div>
      )}
    </>
  );
}
