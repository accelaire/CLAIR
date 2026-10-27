import type { PageMeta, ScrutinListItem } from "@clair/data";
import {
  archivesQueryOf,
  filArianeJsonLd,
  parseAnnee,
  parseVotesArchivesParams,
  VotesArchivesScreen,
} from "@clair/screens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd.tsx";
import { fetchResource } from "@/lib/api-server.ts";
import { SITE_URL } from "@/lib/env.ts";

export const revalidate = 3600;

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ year: string }>; searchParams: Promise<SearchParams> };

export const generateMetadata = async ({ params, searchParams }: Props): Promise<Metadata> => {
  const annee = parseAnnee((await params).year);
  if (annee === null) return {};
  const { page } = parseVotesArchivesParams(await searchParams);
  const suffixe = page > 1 ? ` — page ${page}` : "";
  const title = `Votes ${annee} — Assemblée nationale et Sénat${suffixe}`;
  const description = `Tous les scrutins publics de l'Assemblée nationale et du Sénat en ${annee}. Résultats des votes, dates et positions par groupe politique.`;
  const canonical = page > 1 ? `/votes/${annee}?page=${page}` : `/votes/${annee}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
    // Seule la première page est indexée ; les suivantes restent suivies.
    robots: page > 1 ? { index: false, follow: true } : undefined,
  };
};

const Page = async ({ params, searchParams }: Props) => {
  const annee = parseAnnee((await params).year);
  if (annee === null) notFound();
  const raw = await searchParams;
  const query = parseVotesArchivesParams(raw);
  const periode = { annee, mois: null };
  const scrutins = await fetchResource<PageMeta<ScrutinListItem>>(
    "/scrutins",
    archivesQueryOf(periode, query),
  );
  // Page au-delà de la dernière : 404 plutôt qu'une page vide explorable.
  if (query.page > 1 && scrutins?.data.length === 0 && scrutins.meta.total > 0) notFound();
  return (
    <>
      <JsonLd
        data={[
          filArianeJsonLd(SITE_URL, [
            { nom: "Archives des votes", chemin: "/votes" },
            { nom: `Votes ${annee}`, chemin: `/votes/${annee}` },
          ]),
        ]}
      />
      <VotesArchivesScreen
        periode={periode}
        params={raw}
        initialData={{ scrutins: scrutins ?? undefined }}
      />
    </>
  );
};

export default Page;
