import {
  parseRechercheParams,
  type RechercheReponse,
  RechercheScreen,
  rechercheValide,
  searchQueryOf,
} from "@clair/screens";
import type { Metadata } from "next";
import { fetchListe } from "@/lib/api-server.ts";

export const revalidate = 3600;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = {
  title: "Recherche",
  description:
    "Recherchez sur CLAIR.vote des parlementaires, groupes, commissions, scrutins, sujets, lobbyistes et dossiers législatifs.",
  alternates: { canonical: "/recherche" },
};

/**
 * Résultats de la recherche demandée, rendus côté serveur ; si l'API ne répond pas, la page est
 * servie quand même et l'écran relance la recherche dans le navigateur.
 */
const Page = async ({ searchParams }: Props) => {
  const raw = await searchParams;
  const params = parseRechercheParams(raw);
  const initialData = rechercheValide(params)
    ? await fetchListe<RechercheReponse>(
        "/search",
        Object.fromEntries(
          Object.entries(searchQueryOf(params)).map(([cle, valeur]) => [cle, String(valeur)]),
        ),
      )
    : null;
  return <RechercheScreen params={raw} initialData={initialData ?? undefined} />;
};

export default Page;
