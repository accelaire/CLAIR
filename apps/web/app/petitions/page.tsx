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
import type { PetitionsResponse } from '@/lib/petitions';
import PageClient from './PageClient';

// Rendu à la demande : sans ça, le HTML servi n'est que le squelette de
// chargement. Motif et contreparties détaillés dans `lib/liste-ssr`.
export const dynamic = 'force-dynamic';

const CHEMIN = '/petitions';

/** Clés de filtre que le `PageClient` lit dans l'URL. */
const FILTRES = ['search', 'chambre', 'commission', 'collecte', 'etape', 'suivies', 'sort'] as const;

const METADATA: Metadata = {
  title: 'Pétitions citoyennes',
  description:
    "Les pétitions déposées à l'Assemblée nationale et au Sénat, et ce qu'elles deviennent : rapporteur nommé, décision de la commission, rapport. Signatures et parcours sur CLAIR.vote.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}${CHEMIN}`,
  },
  openGraph: {
    title: 'Pétitions citoyennes — Assemblée nationale & Sénat',
    description: 'Suivez les pétitions qui arrivent en commission et ce qu’elles deviennent.',
  },
};

export async function generateMetadata({ searchParams }: { searchParams: ParametresUrl }): Promise<Metadata> {
  return metadonneesListe(METADATA, CHEMIN, pageListe(searchParams, FILTRES));
}

export default async function PetitionsPage({ searchParams }: { searchParams: ParametresUrl }) {
  const page = pageListe(searchParams, FILTRES);

  const initialPetitions = await fetchFromApi<PetitionsResponse>(
    `${CHEMIN}?page=${page ?? 1}&limit=20`,
    REVALIDATE_LISTE_S,
  );

  // Au-delà de la dernière page, l'API répond une liste vide en 200 : ne pas
  // ouvrir un espace explorable sans fond.
  if (page !== null && page > 1 && initialPetitions?.data.length === 0) notFound();

  return (
    <>
      <PageClient initialPetitions={initialPetitions ?? undefined} initialPage={page ?? 1} />
      {page !== null && initialPetitions && (
        <div className="container mx-auto px-4 pb-8">
          <Pagination basePath={CHEMIN} currentPage={page} totalPages={initialPetitions.meta.totalPages} />
        </div>
      )}
    </>
  );
}
