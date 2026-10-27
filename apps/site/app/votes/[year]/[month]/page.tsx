import type { PageMeta, ScrutinListItem } from "@clair/data";
import {
  archivesQueryOf,
  filArianeJsonLd,
  libellePeriode,
  parseAnnee,
  parseMois,
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
type Props = {
  params: Promise<{ year: string; month: string }>;
  searchParams: Promise<SearchParams>;
};

const periodeDe = async (params: Props["params"]) => {
  const { year, month } = await params;
  const annee = parseAnnee(year);
  const mois = parseMois(month);
  return annee === null || mois === null ? null : { annee, mois, mm: month };
};

export const generateMetadata = async ({ params, searchParams }: Props): Promise<Metadata> => {
  const periode = await periodeDe(params);
  if (!periode) return {};
  const { page } = parseVotesArchivesParams(await searchParams);
  const nom = libellePeriode(periode);
  const suffixe = page > 1 ? ` — page ${page}` : "";
  const title = `Votes ${nom.charAt(0).toUpperCase()}${nom.slice(1)} — Assemblée nationale et Sénat${suffixe}`;
  const description = `Tous les scrutins publics de l'Assemblée nationale et du Sénat en ${nom}. Résultats des votes, dates et positions par groupe politique.`;
  const chemin = `/votes/${periode.annee}/${periode.mm}`;
  const canonical = page > 1 ? `${chemin}?page=${page}` : chemin;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
    robots: page > 1 ? { index: false, follow: true } : undefined,
  };
};

const Page = async ({ params, searchParams }: Props) => {
  const periode = await periodeDe(params);
  if (!periode) notFound();
  const raw = await searchParams;
  const query = parseVotesArchivesParams(raw);
  const cible = { annee: periode.annee, mois: periode.mois };
  const scrutins = await fetchResource<PageMeta<ScrutinListItem>>(
    "/scrutins",
    archivesQueryOf(cible, query),
  );
  // Un mois sans scrutin, ou une page au-delà de la dernière : 404 (comme apps/web).
  if (!scrutins || scrutins.meta.total === 0) notFound();
  if (query.page > 1 && scrutins.data.length === 0) notFound();
  const nom = libellePeriode(cible);
  return (
    <>
      <JsonLd
        data={[
          filArianeJsonLd(SITE_URL, [
            { nom: "Archives des votes", chemin: "/votes" },
            { nom: `Votes ${periode.annee}`, chemin: `/votes/${periode.annee}` },
            {
              nom: `${nom.charAt(0).toUpperCase()}${nom.slice(1)}`,
              chemin: `/votes/${periode.annee}/${periode.mm}`,
            },
          ]),
        ]}
      />
      <VotesArchivesScreen periode={cible} params={raw} initialData={{ scrutins }} />
    </>
  );
};

export default Page;
