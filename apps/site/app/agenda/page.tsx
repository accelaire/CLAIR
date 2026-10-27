import type { AgendaResponse } from "@clair/data";
import { AgendaScreen, agendaQueryOf, jourParis, parseAgendaParams } from "@clair/screens";
import type { Metadata } from "next";
import { fetchListe } from "@/lib/api-server.ts";

export const revalidate = 3600;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = {
  title: "Agenda parlementaire",
  description:
    "Calendrier des réunions de commissions et des séances publiques de l'Assemblée nationale et du Sénat. Suivez l'activité parlementaire au jour le jour sur CLAIR.vote.",
  alternates: { canonical: "/agenda" },
  openGraph: {
    title: "Agenda parlementaire — CLAIR.vote",
    description: "Réunions de commissions et séances publiques. Assemblée nationale & Sénat.",
  },
};

/** Paramètres de requête en chaînes, valeurs vides omises. */
const enChaines = (query: Record<string, string | number>) =>
  Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== "")
      .map(([key, value]) => [key, String(value)]),
  );

/**
 * Le mois affiché est rendu côté serveur. Aujourd'hui (heure de Paris) est fixé ici et transmis
 * à l'écran : serveur et navigateur affichent le même mois et le même jour.
 */
const Page = async ({ searchParams }: Props) => {
  const raw = await searchParams;
  const aujourdhui = jourParis(new Date());
  const initialData = await fetchListe<AgendaResponse>(
    "/agenda",
    enChaines(agendaQueryOf(parseAgendaParams(raw), aujourdhui)),
  );
  return (
    <AgendaScreen params={raw} aujourdhui={aujourdhui} initialData={initialData ?? undefined} />
  );
};

export default Page;
