import type { PageMeta, SujetDetail, SujetDossier } from "@clair/data";
import { DOSSIERS_DU_SUJET, filArianeJsonLd, SujetFicheScreen } from "@clair/screens";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { JsonLd } from "@/components/JsonLd.tsx";
import { fetchResource } from "@/lib/api-server.ts";
import { SITE_URL } from "@/lib/env.ts";

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const chargerSujet = cache((slug: string) =>
  fetchResource<{ data: SujetDetail }>(`/sujets/${encodeURIComponent(slug)}`),
);

/**
 * Un sujet désactivé (137 le 2026-07-29) renvoie vers son dossier, le contenu le plus proche de
 * ce que l'adresse promettait ; une panne de cette recherche ne doit pas empêcher le 404.
 */
const dossierDuSujetArchive = async (slug: string) => {
  try {
    const archive = await fetchResource<{ data: { dossierUid: string | null } }>(
      `/sujets/${encodeURIComponent(slug)}/archive`,
    );
    return archive?.data.dossierUid ?? null;
  } catch {
    return null;
  }
};

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { slug } = await params;
  const sujet = (await chargerSujet(slug))?.data;
  if (!sujet) return {};
  const resume =
    sujet.description ||
    `Sujet politique : ${sujet.label}. ${sujet.dossierCount} dossier${sujet.dossierCount > 1 ? "s" : ""} législatif${sujet.dossierCount > 1 ? "s" : ""}, ${sujet.scrutinCount} scrutin${sujet.scrutinCount > 1 ? "s" : ""}.`;
  const description = `${resume} Suivez les votes et dossiers sur CLAIR.vote.`;
  const url = `/sujets/${sujet.slug}`;
  return {
    title: sujet.label,
    description,
    alternates: { canonical: url },
    openGraph: { title: sujet.label, description, url, type: "article" },
    twitter: { card: "summary_large_image", title: sujet.label, description },
  };
};

const Page = async ({ params, searchParams }: Props) => {
  const { slug } = await params;
  const sujet = await chargerSujet(slug);
  if (!sujet) {
    const dossierUid = await dossierDuSujetArchive(slug);
    if (dossierUid) permanentRedirect(`/dossiers/${dossierUid}`);
    notFound();
  }
  const dossiers = await fetchResource<PageMeta<SujetDossier>>(
    `/sujets/${encodeURIComponent(slug)}/dossiers`,
    { limit: String(DOSSIERS_DU_SUJET.limit) },
  ).catch(() => null);
  return (
    <>
      <JsonLd
        data={[
          filArianeJsonLd(SITE_URL, [
            { nom: "Sujets", chemin: "/sujets" },
            { nom: sujet.data.label, chemin: `/sujets/${sujet.data.slug}` },
          ]),
        ]}
      />
      <SujetFicheScreen
        slug={slug}
        params={await searchParams}
        initialData={{ sujet, dossiers: dossiers ?? undefined }}
      />
    </>
  );
};

export default Page;
