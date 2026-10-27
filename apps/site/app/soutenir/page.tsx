import { SoutenirScreen, type SoutenirStats } from "@clair/screens";
import type { Metadata } from "next";
import { fetchResource } from "@/lib/api-server.ts";

export const metadata: Metadata = {
  title: "Soutenir CLAIR - Transparence Politique",
  description:
    "Soutenez CLAIR, la plateforme citoyenne et gratuite de transparence politique. Association d'intérêt général : vos dons sont déductibles à 66 % de vos impôts.",
};

export const revalidate = 3600;

/** Les chiffres sont un plus : si l'API ne répond pas, la page de don reste servie sans eux. */
const loadStats = async () => {
  try {
    const homepage = await fetchResource<{ stats?: SoutenirStats }>("/homepage");
    return homepage?.stats;
  } catch {
    return undefined;
  }
};

const Page = async () => <SoutenirScreen initialData={await loadStats()} />;

export default Page;
