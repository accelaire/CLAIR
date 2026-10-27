import type { ApiData, GroupePolitique } from "@clair/data";
import { GroupesListeScreen } from "@clair/screens";
import type { Metadata } from "next";
import { fetchResource } from "@/lib/api-server.ts";

export const metadata: Metadata = {
  title: "Groupes politiques",
  description:
    "Groupes politiques de l'Assemblée nationale et du Sénat. Membres, votes et positions politiques sur CLAIR.vote.",
  alternates: { canonical: "/groupes" },
  openGraph: {
    title: "Groupes politiques — Assemblée nationale et Sénat",
    description: "Explorez les groupes parlementaires, leurs membres et leurs votes.",
  },
};

export const revalidate = 3600;

/** Vue par défaut (les deux chambres, période courante) ; sinon l'écran charge lui-même. */
const chargerGroupes = async () => {
  try {
    return (
      (await fetchResource<ApiData<GroupePolitique[]>>("/parlementaires/groupes")) ?? undefined
    );
  } catch {
    return undefined;
  }
};

const Page = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  const vueParDefaut = !params.chambre && !params.legislature && !params.session;
  const initialData = vueParDefaut ? await chargerGroupes() : undefined;
  return <GroupesListeScreen params={params} initialData={initialData} />;
};

export default Page;
