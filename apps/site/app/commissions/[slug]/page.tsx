import type { ApiData, CommissionDetail } from "@clair/data";
import { CommissionFicheScreen, typeCommission } from "@clair/screens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { fetchResource } from "@/lib/api-server.ts";

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Un seul appel par rendu pour les métadonnées et la page. */
const loadCommission = cache((slug: string) =>
  fetchResource<ApiData<CommissionDetail>>(`/commissions/${encodeURIComponent(slug)}`),
);

const CHAMBRE = { assemblee: "Assemblée nationale", senat: "Sénat" } as const;

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { slug } = await params;
  const commission = (await loadCommission(slug))?.data;
  if (!commission) return {};
  const chambre = CHAMBRE[commission.chambre];
  // Un mandat par qualité : un même parlementaire peut figurer deux fois.
  const nbMembres = new Set(commission.membres.map((m) => m.parlementaire.id)).size;
  const title = `${commission.nom} — ${chambre}`;
  const description = `${typeCommission(commission.type).singulier} (${chambre}). ${nbMembres} membres, ${commission.nbReunions} réunions. Suivez son activité sur CLAIR.vote.`;
  const url = `/commissions/${commission.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  };
};

const Page = async ({ params, searchParams }: Props) => {
  const { slug } = await params;
  const commission = await loadCommission(slug);
  if (!commission) notFound();
  return (
    <CommissionFicheScreen
      slug={slug}
      params={await searchParams}
      initialData={commission}
      maintenant={Date.now()}
    />
  );
};

export default Page;
