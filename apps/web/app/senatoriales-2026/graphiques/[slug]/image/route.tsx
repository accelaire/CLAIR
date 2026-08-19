import { imageGraphique } from '@/lib/senatoriales/og-graphiques';
import { SLUGS_GRAPHIQUES, estSlugGraphique } from '@/lib/senatoriales/graphiques';

export const runtime = 'nodejs';
export const revalidate = 3600;

export function generateStaticParams() {
  return SLUGS_GRAPHIQUES.map((slug) => ({ slug }));
}

/**
 * Le PNG que remet le bouton « Télécharger l'image ».
 *
 * Route distincte de `opengraph-image`, mais même fonction de rendu : l'adresse
 * publique d'une image Open Graph porte une empreinte calculée au build, qu'on
 * ne peut pas écrire à la main dans un lien. Plutôt que de deviner cette
 * adresse, on expose un chemin stable — au passage, il permet de nommer le
 * fichier téléchargé et d'en faire une pièce jointe plutôt qu'un onglet.
 *
 * Les deux routes partagent `imageGraphique`, donc le même visuel et le même
 * bandeau CLAIR : l'image enregistrée est celle que verront les destinataires.
 */
export async function GET(_requete: Request, { params }: { params: { slug: string } }) {
  if (!estSlugGraphique(params.slug)) {
    return new Response('Graphique inconnu', { status: 404 });
  }

  const image = await imageGraphique(params.slug);

  const entetes = new Headers(image.headers);
  entetes.set(
    'Content-Disposition',
    `attachment; filename="clair-senatoriales-2026-${params.slug}.png"`,
  );
  // Une image de graphique ne change qu'au rythme des données, soit une fois par
  // nuit. Sans cette consigne, chaque téléchargement repasserait par la fonction
  // de rendu — le poste de dépense le plus cher de la chaîne.
  entetes.set('Cache-Control', 'public, max-age=0, must-revalidate');
  entetes.set('Vercel-CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  return new Response(image.body, { status: image.status, headers: entetes });
}
