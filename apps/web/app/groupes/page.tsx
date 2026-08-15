import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { REVALIDATE_LISTE_S } from '@/lib/liste-ssr';
import PageClient, { type GroupePolitique } from './PageClient';

// Rendu à la demande : sans ça, le HTML servi n'est que le squelette de
// chargement. Motif et contreparties détaillés dans `lib/liste-ssr`.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Groupes politiques',
  description:
    'Groupes politiques de l\'Assemblée nationale et du Sénat. Membres, votes et positions politiques sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/groupes`,
  },
  openGraph: {
    title: 'Groupes politiques — Assemblée nationale et Sénat',
    description:
      'Explorez les groupes parlementaires, leurs membres et leurs votes.',
  },
};

export default async function GroupesPage() {
  const initialGroupes = await fetchFromApi<{ data: GroupePolitique[] }>(
    '/parlementaires/groupes',
    REVALIDATE_LISTE_S,
  );

  return <PageClient initialGroupes={initialGroupes ?? undefined} />;
}
