import type { CommissionsPage } from "@clair/data";
import { CommissionsListeScreen } from "@clair/screens";
import type { Metadata } from "next";
import { fetchListe } from "@/lib/api-server.ts";

export const revalidate = 3600;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = {
  title: "Commissions parlementaires",
  description:
    "Liste des commissions permanentes, d'enquête et spéciales de l'Assemblée nationale et du Sénat. Membres, réunions et activité sur CLAIR.vote.",
  alternates: { canonical: "/commissions" },
  openGraph: {
    title: "Commissions parlementaires — Assemblée nationale & Sénat",
    description:
      "Toutes les commissions parlementaires : permanentes, d'enquête, spéciales. Membres et réunions.",
  },
};

/** La vue par défaut (commissions actives) est rendue côté serveur ; un filtre la recharge. */
const Page = async ({ searchParams }: Props) => {
  const raw = await searchParams;
  const initialData = await fetchListe<CommissionsPage>("/commissions", {
    actif: "true",
    limit: "500",
  });
  return <CommissionsListeScreen params={raw} initialData={initialData ?? undefined} />;
};

export default Page;
