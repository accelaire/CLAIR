import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import PageClient from './PageClient';
import type { ApercuSenatoriales, Sortant } from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

const title = 'Sénatoriales 2026 — le bilan des sortants';
const description =
  "Le 27 septembre 2026, 178 des 348 sièges du Sénat sont renouvelés dans 64 départements. Présence, loyauté, interventions et amendements : le bilan de mandature de chaque sénateur sortant sur CLAIR.vote.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${BASE_URL}/senatoriales-2026` },
  openGraph: {
    title: 'Sénatoriales du 27 septembre 2026 — CLAIR.vote',
    description:
      "178 sièges renouvelés, 64 départements. Le bilan de mandature des sénateurs sortants, chiffres à l'appui.",
    url: `${BASE_URL}/senatoriales-2026`,
    type: 'article',
  },
  // Sans bloc `twitter` explicite, Next conserve celui du layout : la carte
  // partagée affichait le titre générique du site au lieu de celui de la page.
  twitter: {
    card: 'summary_large_image',
    title: 'Sénatoriales du 27 septembre 2026',
    description:
      "178 sièges renouvelés, 64 départements. Le bilan de mandature des sénateurs sortants.",
  },
};

/**
 * Les données sont chargées ici, côté serveur, et non seulement dans le composant
 * client : sans ça le HTML servi ne contient que le squelette de chargement. Aucun
 * nom de sénateur, aucun département, pas même le texte d'explication — tout le
 * contenu indexable de la page était invisible pour qui n'exécute pas le
 * JavaScript, ce qui est le cas des robots d'aperçu social et d'une partie des
 * moteurs.
 */
async function chargerDonnees() {
  const [apercu, sortants] = await Promise.all([
    fetchFromApi<ApercuSenatoriales>('/senatoriales/2026', 3600),
    fetchFromApi<{ data: Sortant[]; meta: { total: number } }>(
      '/senatoriales/2026/sortants',
      3600,
    ),
  ]);
  return { apercu, sortants };
}

export default async function Senatoriales2026Page() {
  const { apercu, sortants } = await chargerDonnees();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Accueil', url: BASE_URL },
          { name: 'Sénatoriales 2026', url: `${BASE_URL}/senatoriales-2026` },
        ]}
      />
      <PageClient
        initialApercu={apercu ?? undefined}
        initialSortants={sortants ?? undefined}
      />
    </>
  );
}
