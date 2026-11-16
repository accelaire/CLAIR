import type { GouvernementDetailReponse } from "@clair/data";
import {
  dateGouvernement,
  filArianeJsonLd,
  GouvernementFicheScreen,
  nomMembreGouvernement,
} from "@clair/screens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { JsonLd } from "@/components/JsonLd.tsx";
import { fetchResource } from "@/lib/api-server.ts";
import { SITE_URL } from "@/lib/env.ts";

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Un seul appel par rendu pour les métadonnées et la page ; `null` sur un vrai 404 seulement. */
const chargerGouvernement = cache((slug: string) =>
  fetchResource<GouvernementDetailReponse>(`/gouvernements/${encodeURIComponent(slug)}`),
);

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { slug } = await params;
  const g = (await chargerGouvernement(slug))?.data;
  if (!g) return {};
  const title = g.bilan
    ? `Gouvernement ${g.nom} : composition, bilan et dates`
    : `Gouvernement ${g.nom} : composition et dates`;
  const periode = g.dateFin
    ? `du ${dateGouvernement(g.dateDebut)} au ${dateGouvernement(g.dateFin)}`
    : `depuis le ${dateGouvernement(g.dateDebut)}`;
  const description =
    `Le gouvernement ${g.nom}${g.premierMinistre ? `, dirigé par ${nomMembreGouvernement(g.premierMinistre)}` : ""}, ${periode} : ` +
    `${g.nbMembres} membres, leurs portefeuilles par domaine, les remaniements` +
    (g.bilan
      ? `, ${g.bilan.textes.portes} projets de loi portés, ${g.bilan.engagements.length} recours au 49.3 et ${g.bilan.motions.total} motions de censure`
      : "") +
    ", d'après l'open data de l'Assemblée nationale.";
  const url = `/gouvernements/${g.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  };
};

const Page = async ({ params, searchParams }: Props) => {
  const { slug } = await params;
  const reponse = await chargerGouvernement(slug);
  if (!reponse) notFound();
  const g = reponse.data;
  return (
    <>
      <JsonLd
        data={[
          filArianeJsonLd(SITE_URL, [
            { nom: "Gouvernements", chemin: "/gouvernements" },
            { nom: `Gouvernement ${g.nom}`, chemin: `/gouvernements/${g.slug}` },
          ]),
        ]}
      />
      <GouvernementFicheScreen
        slug={slug}
        params={await searchParams}
        initialData={reponse}
        maintenant={Date.now()}
      />
    </>
  );
};

export default Page;
