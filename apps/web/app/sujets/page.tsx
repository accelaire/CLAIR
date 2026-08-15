import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { REVALIDATE_LISTE_S } from '@/lib/liste-ssr';
import PageClient, { type Sujet, type SujetsResponse } from './PageClient';

// Rendu à la demande : sans ça, le HTML servi n'est que le squelette de
// chargement. Motif et contreparties détaillés dans `lib/liste-ssr`.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sujets',
  description:
    "Suivez chaque grand texte de loi de bout en bout sur CLAIR.vote : son parcours entre l'Assemblée nationale et le Sénat, les scrutins, les votes par groupe et son issue.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/sujets`,
  },
  openGraph: {
    title: 'Sujets parlementaires',
    description:
      "Chaque grand texte de loi suivi de son dépôt à son issue : parcours entre l'Assemblée et le Sénat, scrutins et votes par groupe politique.",
  },
};

/**
 * L'API plafonne à 100 sujets par page et le client les agrège tous : on
 * reproduit la même boucle côté serveur, sans quoi la donnée initiale ne
 * couvrirait qu'un septième de la liste et le composant repartirait en
 * chargement dès le montage.
 *
 * La borne à 20 pages est un garde-fou : elle couvre largement le corpus actuel
 * (moins de 700 sujets) et empêche une réponse aberrante de faire boucler le
 * rendu.
 */
async function chargerSujets(): Promise<Sujet[] | null> {
  const tous: Sujet[] = [];

  for (let page = 1; page <= 20; page++) {
    const lot = await fetchFromApi<SujetsResponse>(
      `/sujets?page=${page}&limit=100`,
      REVALIDATE_LISTE_S,
    );
    // Un échec en cours de route rendrait une liste tronquée, plus trompeuse
    // qu'une absence de donnée : on laisse le client refaire l'appel.
    if (!lot) return null;

    tous.push(...lot.data);
    if (!lot.meta.hasNext) break;
  }

  return tous;
}

export default async function SujetsPage() {
  const initialSujets = await chargerSujets();

  return <PageClient initialSujets={initialSujets ?? undefined} />;
}
