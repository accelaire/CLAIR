import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { REVALIDATE_LISTE_S } from '@/lib/liste-ssr';
import PageClient, { type CommissionsResponse } from './PageClient';

// Rendu à la demande : sans ça, le HTML servi n'est que le squelette de
// chargement. Motif et contreparties détaillés dans `lib/liste-ssr`.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Commissions parlementaires',
  description:
    'Liste des commissions permanentes, d\'enquête et spéciales de l\'Assemblée nationale et du Sénat. Membres, réunions et activité sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/commissions`,
  },
  openGraph: {
    title: 'Commissions parlementaires — Assemblée nationale & Sénat',
    description:
      'Toutes les commissions parlementaires : permanentes, d\'enquête, spéciales. Membres et réunions en temps réel.',
  },
};

export default async function CommissionsPage() {
  const initialCommissions = await fetchFromApi<CommissionsResponse>(
    '/commissions?actif=true&limit=500',
    REVALIDATE_LISTE_S,
  );

  return <PageClient initialCommissions={initialCommissions ?? undefined} />;
}
