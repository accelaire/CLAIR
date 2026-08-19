import { notFound } from 'next/navigation';
import { OG_SIZE } from '@/lib/og';
import { imageGraphique } from '@/lib/senatoriales/og-graphiques';
import {
  GRAPHIQUES,
  SLUGS_GRAPHIQUES,
  estSlugGraphique,
} from '@/lib/senatoriales/graphiques';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;

/**
 * Aperçu social d'un graphique.
 *
 * Pré-généré pour les sept graphiques et revalidé à l'heure, comme la page :
 * l'aperçu se fabrique alors avant le premier partage plutôt qu'au moment où le
 * robot du réseau social le réclame — moment où il n'attend pas.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return SLUGS_GRAPHIQUES.map((slug) => ({ slug }));
}

export function generateImageMetadata({ params }: { params: { slug: string } }) {
  if (!estSlugGraphique(params.slug)) return [];
  return [
    {
      id: params.slug,
      size: OG_SIZE,
      alt: `${GRAPHIQUES[params.slug].titre} — Sénatoriales 2026, CLAIR.vote`,
      contentType: 'image/png',
    },
  ];
}

export default async function Image({ params }: { params: { slug: string } }) {
  if (!estSlugGraphique(params.slug)) notFound();
  return imageGraphique(params.slug);
}
