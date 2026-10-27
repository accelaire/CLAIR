import { ParlementairesListeScreen } from "@clair/screens";
import type { Metadata } from "next";
import { chargerListe, type SearchParams } from "../_parlementaires/chargement.ts";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Députés",
  description:
    "Liste des députés de l'Assemblée nationale. Recherchez par nom, groupe politique ou département. Votes, présence et activité sur CLAIR.vote.",
  alternates: { canonical: "/deputes" },
};

const Page = async ({ searchParams }: { searchParams: Promise<SearchParams> }) => {
  const params = await searchParams;
  return (
    <ParlementairesListeScreen
      chambre="assemblee"
      params={params}
      initialData={await chargerListe("assemblee", params)}
    />
  );
};

export default Page;
