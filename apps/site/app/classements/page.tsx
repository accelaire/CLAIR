import { ClassementsScreen } from "@clair/screens";
import type { Metadata } from "next";
import { queryImageClassements } from "@/lib/og-classements.ts";

export const revalidate = 3600;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const CRITERES: Record<string, string> = {
  presence: "présence",
  loyaute: "loyauté",
  amendements: "amendements",
  interventions: "interventions",
};

/** Critères de l'onglet Groupes (`groupeSort`), distincts de ceux des parlementaires (`sort`). */
const CRITERES_GROUPE: Record<string, string> = {
  presence: "présence",
  loyaute: "loyauté",
  cohesion: "cohésion",
  membres: "nombre de membres",
};

const CHAMBRES: Record<string, string> = { assemblee: "Assemblée nationale", senat: "Sénat" };

const premier = (valeur: string | string[] | undefined) =>
  (Array.isArray(valeur) ? valeur[0] : valeur) ?? "";

/** Titre et description selon l'onglet, le critère et la chambre (comme apps/web). */
export const generateMetadata = async ({ searchParams }: Props): Promise<Metadata> => {
  const params = await searchParams;
  const critere = CRITERES[premier(params.sort)] ?? "présence";
  const chambre = CHAMBRES[premier(params.chambre)] ?? "";
  const entre = chambre ? ` (${chambre})` : "";
  const [title, description] = premier(params.highlight)
    ? [
        `Classement par ${critere}`,
        `Découvrez le classement des parlementaires par ${critere}${entre} sur CLAIR.vote.`,
      ]
    : premier(params.tab) === "groupes"
      ? [
          "Classement des groupes politiques",
          `Comparez les groupes politiques par ${CRITERES_GROUPE[premier(params.groupeSort)] ?? "présence"}${entre}. Indicateurs calculés par CLAIR à partir des données officielles.`,
        ]
      : [
          `Classement par ${critere}${chambre ? ` — ${chambre}` : ""}`,
          `Classement des parlementaires par ${critere}${entre}. Top et flop, indicateurs calculés par CLAIR à partir des données officielles.`,
        ];
  // Image qui suit l'onglet, le critère et le parlementaire mis en avant (og/route.tsx).
  const image = {
    url: `/classements/og?${queryImageClassements(params)}`,
    width: 1200,
    height: 630,
    type: "image/png",
  };
  return {
    title,
    description,
    alternates: { canonical: "/classements" },
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
};

const Page = async ({ searchParams }: Props) => <ClassementsScreen params={await searchParams} />;

export default Page;
