import type { ListeSortants } from "@clair/data";
import {
  estSlugGraphique,
  filArianeJsonLd,
  GRAPHIQUES,
  GraphiqueScreen,
  SLUGS_GRAPHIQUES,
} from "@clair/screens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd.tsx";
import { fetchListe } from "@/lib/api-server.ts";
import { SITE_URL } from "@/lib/env.ts";
import { chargerApercu } from "../../_chargement.ts";

/**
 * Une page par graphique, pour que l'aperçu partagé (qui ne reçoit que le chemin) soit celui du
 * graphique. Ces pages ne lisent aucun paramètre de recherche : pré-rendues et revalidées à
 * l'heure. API injoignable au rendu : la page est servie et l'écran charge les données.
 */
export const revalidate = 3600;

export const generateStaticParams = () => SLUGS_GRAPHIQUES.map((slug) => ({ slug }));

type Props = { params: Promise<{ slug: string }> };

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { slug } = await params;
  if (!estSlugGraphique(slug)) return {};
  const meta = GRAPHIQUES[slug];
  const url = `/senatoriales-2026/graphiques/${slug}`;
  const titre = `${meta.titre} — Sénatoriales 2026`;
  return {
    title: titre,
    description: meta.sousTitre,
    alternates: { canonical: url },
    openGraph: { title: titre, description: meta.sousTitre, url, type: "article" },
    twitter: { card: "summary_large_image", title: meta.titre, description: meta.sousTitre },
  };
};

const Page = async ({ params }: Props) => {
  const { slug } = await params;
  if (!estSlugGraphique(slug)) notFound();
  const meta = GRAPHIQUES[slug];
  const [apercu, sortants] = await Promise.all([
    chargerApercu(),
    fetchListe<ListeSortants>("/senatoriales/2026/sortants"),
  ]);

  return (
    <>
      <JsonLd
        data={[
          filArianeJsonLd(SITE_URL, [
            { nom: "Sénatoriales 2026", chemin: "/senatoriales-2026" },
            { nom: meta.titre, chemin: `/senatoriales-2026/graphiques/${slug}` },
          ]),
        ]}
      />
      <GraphiqueScreen
        slug={slug}
        initialData={{ apercu: apercu ?? undefined, sortants: sortants ?? undefined }}
      />
    </>
  );
};

export default Page;
