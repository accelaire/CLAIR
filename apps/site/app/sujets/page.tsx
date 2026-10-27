import { type SujetsListeInitial, SujetsListeScreen } from "@clair/screens";
import type { Metadata } from "next";
import { fetchResource } from "@/lib/api-server.ts";

export const metadata: Metadata = {
  title: "Sujets",
  description:
    "Suivez chaque grand texte de loi de bout en bout sur CLAIR.vote : son parcours entre l'Assemblée nationale et le Sénat, les scrutins, les votes par groupe et son issue.",
  alternates: { canonical: "/sujets" },
  openGraph: {
    title: "Sujets parlementaires",
    description:
      "Chaque grand texte de loi suivi de son dépôt à son issue : parcours entre l'Assemblée et le Sénat, scrutins et votes par groupe politique.",
  },
};

export const revalidate = 3600;

type SujetsPage = SujetsListeInitial[number];

/**
 * Toutes les pages de sujets (100 par page, 20 pages au plus), comme le fait l'écran. Une page
 * manquante rendrait une liste tronquée, plus trompeuse qu'une absence : l'écran recharge alors.
 */
const chargerSujets = async (): Promise<SujetsListeInitial | undefined> => {
  const pages: SujetsPage[] = [];
  try {
    for (let page = 1; page <= 20; page++) {
      const lot = await fetchResource<SujetsPage>("/sujets", {
        page: String(page),
        limit: "100",
      });
      if (!lot) return undefined;
      pages.push(lot);
      if (!lot.meta.hasNext) break;
    }
  } catch {
    return undefined;
  }
  return pages;
};

const Page = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  const initialData = params.search ? undefined : await chargerSujets();
  return <SujetsListeScreen params={params} initialData={initialData} maintenant={Date.now()} />;
};

export default Page;
