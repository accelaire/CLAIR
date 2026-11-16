import type { GouvernementsReponse } from "@clair/data";
import { filArianeJsonLd, GouvernementsListeScreen } from "@clair/screens";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd.tsx";
import { fetchListe } from "@/lib/api-server.ts";
import { SITE_URL } from "@/lib/env.ts";

// Les données ne changent qu'avec l'ingestion de la nuit.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Gouvernements de la Ve République depuis 2007",
  description:
    "Tous les gouvernements depuis Fillon I (2007) : Premier ministre, président de la République, dates et composition, d'après l'open data de l'Assemblée nationale.",
  alternates: { canonical: "/gouvernements" },
};

/** Liste rendue côté serveur ; API injoignable : chargement dans le navigateur. */
const Page = async () => {
  const initialData = await fetchListe<GouvernementsReponse>("/gouvernements");
  return (
    <>
      <JsonLd
        data={[filArianeJsonLd(SITE_URL, [{ nom: "Gouvernements", chemin: "/gouvernements" }])]}
      />
      <GouvernementsListeScreen initialData={initialData ?? undefined} maintenant={Date.now()} />
    </>
  );
};

export default Page;
