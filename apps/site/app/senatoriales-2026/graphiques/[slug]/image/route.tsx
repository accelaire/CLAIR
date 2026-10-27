import { estSlugGraphique, SLUGS_GRAPHIQUES } from "@clair/screens";
import { imageGraphique } from "../../../_og/graphiques.tsx";

export const runtime = "nodejs";
export const revalidate = 3600;

export const generateStaticParams = () => SLUGS_GRAPHIQUES.map((slug) => ({ slug }));

/**
 * Le PNG du bouton « Télécharger l'image » : même rendu que l'aperçu Open Graph, à une adresse
 * stable (celle de l'image OG porte une empreinte calculée au build), en pièce jointe nommée.
 */
export const GET = async (_requete: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  if (!estSlugGraphique(slug)) return new Response("Graphique inconnu", { status: 404 });
  const image = await imageGraphique(slug);
  const entetes = new Headers(image.headers);
  entetes.set("Content-Disposition", `attachment; filename="clair-senatoriales-2026-${slug}.png"`);
  // L'image ne change qu'au rythme des données : servie depuis le cache plutôt que refabriquée.
  entetes.set("Cache-Control", "public, max-age=0, must-revalidate");
  entetes.set("Vercel-CDN-Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return new Response(image.body, { status: image.status, headers: entetes });
};
