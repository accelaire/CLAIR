import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { REVALIDATE_LISTE_S } from '@/lib/liste-ssr';
import PageClient, { type ScrutinsResponse } from './PageClient';

// Rendu à la demande : sans ça, le HTML servi n'est que le squelette de
// chargement. Motif et contreparties détaillés dans `lib/liste-ssr`.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Votes — Assemblée nationale et Sénat',
  description:
    'Tous les votes et scrutins publics de l\'Assemblée nationale et du Sénat. Résultats, détail par groupe politique et par parlementaire sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/scrutins`,
  },
  openGraph: {
    title: 'Votes Assemblée nationale et Sénat — Scrutins publics',
    description:
      'Résultats des votes parlementaires. Filtrez par date, sujet ou résultat.',
  },
};

export default async function ScrutinsPage() {
  const initialScrutins = await fetchFromApi<ScrutinsResponse>(
    '/scrutins?page=1&limit=20',
    REVALIDATE_LISTE_S,
  );

  return <PageClient initialScrutins={initialScrutins ?? undefined} />;
}
