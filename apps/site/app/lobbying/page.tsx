import type { LobbyistesPage } from "@clair/data";
import { LobbyingListeScreen, lobbyistesQueryOf, parseLobbyingListeParams } from "@clair/screens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchListe } from "@/lib/api-server.ts";

export const revalidate = 3600;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const generateMetadata = async ({ searchParams }: Props): Promise<Metadata> => {
  const { page } = parseLobbyingListeParams(await searchParams);
  const suffixe = page > 1 ? ` — page ${page}` : "";
  return {
    title: `Lobbying${suffixe}`,
    description:
      "Organisations de lobbying déclarées auprès de la HATVP. Budget, secteurs d'activité et actions de représentation d'intérêts sur CLAIR.vote.",
    alternates: { canonical: page > 1 ? `/lobbying?page=${page}` : "/lobbying" },
    openGraph: {
      title: "Lobbying — Données HATVP",
      description: "Explorez les organisations de lobbying. Filtrez par budget, secteur ou type.",
    },
  };
};

/** Paramètres de requête en chaînes, valeurs vides omises. */
const enChaines = (query: Record<string, string | number | null>) =>
  Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== null && value !== "")
      .map(([key, value]) => [key, String(value)]),
  );

const Page = async ({ searchParams }: Props) => {
  const raw = await searchParams;
  const params = parseLobbyingListeParams(raw);
  const initialData = await fetchListe<LobbyistesPage>(
    "/lobbying",
    enChaines(lobbyistesQueryOf(params)),
  );
  // Au-delà de la dernière page, l'API répond une liste vide : pas de pages explorables sans fin.
  if (params.page > 1 && initialData?.data.length === 0) notFound();
  return <LobbyingListeScreen params={raw} initialData={initialData ?? undefined} />;
};

export default Page;
