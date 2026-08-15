import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { REVALIDATE_LISTE_S } from '@/lib/liste-ssr';
import PageClient, { type SenateursResponse } from './PageClient';

// Rendu à la demande : sans ça, le HTML servi n'est que le squelette de
// chargement. Motif et contreparties détaillés dans `lib/liste-ssr`.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sénateurs',
  description:
    'Liste des sénateurs du Sénat français. Recherchez par nom, groupe politique ou département. Votes, présence et activité sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/senateurs`,
  },
  openGraph: {
    title: 'Sénateurs — Sénat',
    description:
      'Tous les sénateurs en exercice. Filtrez par groupe, département ou activité.',
  },
};

export default async function SenateursPage() {
  const initialSenateurs = await fetchFromApi<SenateursResponse>(
    '/senateurs?page=1&limit=24',
    REVALIDATE_LISTE_S,
  );

  return <PageClient initialSenateurs={initialSenateurs ?? undefined} />;
}
