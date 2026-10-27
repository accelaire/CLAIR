import { estSlugGraphique, GRAPHIQUES, SLUGS_GRAPHIQUES } from "@clair/screens";
import { notFound } from "next/navigation";
import { imageGraphique } from "../../_og/graphiques.tsx";
import { OG_SIZE } from "../../_og/og.tsx";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = OG_SIZE;

/** Pré-généré pour les sept graphiques et revalidé à l'heure, comme la page. */
export const revalidate = 3600;

export const generateStaticParams = () => SLUGS_GRAPHIQUES.map((slug) => ({ slug }));

type Props = { params: Promise<{ slug: string }> };

export const generateImageMetadata = async ({ params }: Props) => {
  const { slug } = await params;
  if (!estSlugGraphique(slug)) return [];
  return [
    {
      id: slug,
      size: OG_SIZE,
      alt: `${GRAPHIQUES[slug].titre} — Sénatoriales 2026, CLAIR.vote`,
      contentType: "image/png",
    },
  ];
};

const Image = async ({ params }: Props) => {
  const { slug } = await params;
  if (!estSlugGraphique(slug)) notFound();
  return imageGraphique(slug);
};

export default Image;
