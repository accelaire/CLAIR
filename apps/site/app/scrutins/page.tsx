import type { PageMeta, ScrutinListItem } from "@clair/data";
import { parseScrutinsListeParams, ScrutinsListeScreen, scrutinsQueryOf } from "@clair/screens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchListe } from "@/lib/api-server.ts";

export const revalidate = 3600;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const generateMetadata = async ({ searchParams }: Props): Promise<Metadata> => {
  const { page } = parseScrutinsListeParams(await searchParams);
  const suffixe = page > 1 ? ` — page ${page}` : "";
  return {
    title: `Votes — Assemblée nationale et Sénat${suffixe}`,
    description:
      "Tous les votes et scrutins publics de l'Assemblée nationale et du Sénat. Résultats, détail par groupe politique et par parlementaire sur CLAIR.vote.",
    alternates: { canonical: page > 1 ? `/scrutins?page=${page}` : "/scrutins" },
    openGraph: {
      title: "Votes Assemblée nationale et Sénat — Scrutins publics",
      description: "Résultats des votes parlementaires. Filtrez par date, sujet ou résultat.",
    },
  };
};

const Page = async ({ searchParams }: Props) => {
  const raw = await searchParams;
  const params = parseScrutinsListeParams(raw);
  const initialData = await fetchListe<PageMeta<ScrutinListItem>>(
    "/scrutins",
    scrutinsQueryOf(params),
  );
  // Au-delà de la dernière page, l'API répond une liste vide : pas de pages explorables sans fin.
  if (params.page > 1 && initialData?.data.length === 0) notFound();
  return <ScrutinsListeScreen params={raw} initialData={initialData ?? undefined} />;
};

export default Page;
