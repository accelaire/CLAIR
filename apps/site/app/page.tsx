import type { HomepageResponse } from "@clair/data";
import { AccueilScreen } from "@clair/screens";
import type { Metadata } from "next";
import { fetchListe } from "@/lib/api-server.ts";

/** Titre et description : ceux du site (layout), comme l'accueil de apps/web. */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** L'agenda des jours à venir change dans la journée : l'API le recalcule toutes les 15 minutes. */
export const revalidate = 900;

/**
 * Données de `/homepage` rendues côté serveur ; si l'API ne répond pas, la page est servie
 * quand même et l'écran les charge dans le navigateur.
 */
const Page = async () => {
  const initialData = await fetchListe<HomepageResponse>("/homepage");
  return <AccueilScreen initialData={initialData ?? undefined} />;
};

export default Page;
