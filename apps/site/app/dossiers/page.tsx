import type { DossierListItem, PageMeta } from "@clair/data";
import { DossiersListeScreen, dossiersQueryOf, parseDossiersListeParams } from "@clair/screens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchListe } from "@/lib/api-server.ts";

export const revalidate = 3600;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const DESCRIPTION =
  "Tous les dossiers législatifs en cours et passés à l'Assemblée nationale et au Sénat. Scrutins, amendements et débats sur CLAIR.vote.";

export const generateMetadata = async ({ searchParams }: Props): Promise<Metadata> => {
  const { page } = parseDossiersListeParams(await searchParams);
  const suffixe = page > 1 ? ` — page ${page}` : "";
  return {
    title: `Dossiers législatifs${suffixe}`,
    description: DESCRIPTION,
    alternates: { canonical: page > 1 ? `/dossiers?page=${page}` : "/dossiers" },
    openGraph: {
      title: "Dossiers législatifs",
      description: "Suivez les projets et propositions de loi. Filtrez par état, chambre ou sujet.",
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
  const params = parseDossiersListeParams(raw);
  const initialData = await fetchListe<PageMeta<DossierListItem>>(
    "/dossiers",
    enChaines(dossiersQueryOf(params)),
  );
  // Au-delà de la dernière page, l'API répond une liste vide : pas de pages explorables sans fin.
  if (params.page > 1 && initialData?.data.length === 0) notFound();
  return <DossiersListeScreen params={raw} initialData={initialData ?? undefined} />;
};

export default Page;
