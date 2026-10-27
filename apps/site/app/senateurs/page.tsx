import { ParlementairesListeScreen } from "@clair/screens";
import type { Metadata } from "next";
import { chargerListe, type SearchParams } from "../_parlementaires/chargement.ts";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Sénateurs",
  description:
    "Liste des sénateurs du Sénat français. Recherchez par nom, groupe politique ou département. Votes, présence et activité sur CLAIR.vote.",
  alternates: { canonical: "/senateurs" },
};

const Page = async ({ searchParams }: { searchParams: Promise<SearchParams> }) => {
  const params = await searchParams;
  return (
    <ParlementairesListeScreen
      chambre="senat"
      params={params}
      initialData={await chargerListe("senat", params)}
    />
  );
};

export default Page;
