import type { AnneeScrutins } from "@clair/data";
import { filArianeJsonLd, VotesArchivesScreen } from "@clair/screens";
import type { Metadata } from "next";
import { connection } from "next/server";
import { JsonLd } from "@/components/JsonLd.tsx";
import { fetchListe } from "@/lib/api-server.ts";
import { SITE_URL } from "@/lib/env.ts";

const DESCRIPTION =
  "Retrouvez tous les scrutins publics de l'Assemblée nationale et du Sénat, classés par année et par mois. Résultats des votes et positions par groupe politique sur CLAIR.vote.";

export const metadata: Metadata = {
  title: "Archives des votes — Assemblée nationale et Sénat",
  description: DESCRIPTION,
  alternates: { canonical: "/votes" },
  openGraph: {
    title: "Archives des votes parlementaires — CLAIR.vote",
    description: "Tous les votes de l'Assemblée nationale et du Sénat classés par année.",
    type: "website",
  },
};

const Page = async () => {
  // Rendue à la demande et non au build : le build ne dépend pas de l'API. La réponse de l'API
  // reste en cache une heure (fetchListe).
  await connection();
  const annees = await fetchListe<{ data: AnneeScrutins[] }>("/scrutins/annees");
  return (
    <>
      <JsonLd
        data={[
          filArianeJsonLd(SITE_URL, [
            { nom: "Scrutins", chemin: "/scrutins" },
            { nom: "Archives des votes", chemin: "/votes" },
          ]),
        ]}
      />
      <VotesArchivesScreen periode={null} initialData={{ annees: annees ?? undefined }} />
    </>
  );
};

export default Page;
