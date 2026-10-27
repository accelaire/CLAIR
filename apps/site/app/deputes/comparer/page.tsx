import { ComparateurScreen } from "@clair/screens";
import type { Metadata } from "next";
import { chargerComparaison, type SearchParams } from "../../_parlementaires/chargement.ts";

export const metadata: Metadata = {
  title: "Comparer des députés",
  description: "Comparez les statistiques et les votes de deux à quatre députés, côte à côte.",
  robots: { index: false, follow: true },
};

const Page = async ({ searchParams }: { searchParams: Promise<SearchParams> }) => {
  const params = await searchParams;
  return (
    <ComparateurScreen
      chambre="assemblee"
      params={params}
      initialData={await chargerComparaison("assemblee", params)}
    />
  );
};

export default Page;
