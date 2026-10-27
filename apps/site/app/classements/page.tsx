import { ClassementsScreen } from "@clair/screens";
import type { Metadata } from "next";

export const revalidate = 3600;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const CRITERES: Record<string, string> = {
  presence: "présence",
  loyaute: "loyauté",
  amendements: "amendements",
  interventions: "interventions",
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
          `Comparez les groupes politiques par ${critere}${entre}. Indicateurs calculés par CLAIR à partir des données officielles.`,
        ]
      : [
          `Classement par ${critere}${chambre ? ` — ${chambre}` : ""}`,
          `Classement des parlementaires par ${critere}${entre}. Top et flop, indicateurs calculés par CLAIR à partir des données officielles.`,
        ];
  return {
    title,
    description,
    alternates: { canonical: "/classements" },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
};

const Page = async ({ searchParams }: Props) => <ClassementsScreen params={await searchParams} />;

export default Page;
