import type { ApiData, ReunionDetail } from "@clair/data";
import {
  filArianeJsonLd,
  libelleDeSeance,
  pointsDeLOrdreDuJour,
  ReunionScreen,
  titreDeReunion,
} from "@clair/screens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { JsonLd } from "@/components/JsonLd.tsx";
import { fetchResource } from "@/lib/api-server.ts";
import { SITE_URL } from "@/lib/env.ts";

export const revalidate = 3600;

type Props = {
  params: Promise<{ uid: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Un seul appel par rendu pour les métadonnées et la page. */
const loadReunion = cache((uid: string) =>
  fetchResource<ApiData<ReunionDetail>>(`/agenda/${encodeURIComponent(uid)}`),
);

/** « mercredi 16 septembre 2026 » (heure de Paris stockée en UTC, comme `libelleDeSeance`). */
const jourDeReunion = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Fil d'Ariane d'une réunion (repris de apps/web) : l'agenda pour une séance publique, la
 * commission sinon, puis la réunion par sa chambre et son jour.
 */
const filDeReunion = (reunion: ReunionDetail) => {
  const chambre = reunion.commission?.chambre === "senat" ? "Sénat" : "Assemblée nationale";
  const parents =
    reunion.type === "seance"
      ? [{ nom: "Agenda", chemin: "/agenda" }]
      : [
          { nom: "Commissions", chemin: "/commissions" },
          ...(reunion.commission
            ? [{ nom: reunion.commission.nom, chemin: `/commissions/${reunion.commission.slug}` }]
            : []),
        ];
  return [
    ...parents,
    {
      nom: `${chambre} — ${jourDeReunion(reunion.dateDebut)}`,
      chemin: `/reunions/${encodeURIComponent(reunion.uid)}`,
    },
  ];
};

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { uid } = await params;
  const reunion = (await loadReunion(uid))?.data;
  if (!reunion) return {};
  const chambre = reunion.commission?.chambre === "senat" ? "Sénat" : "Assemblée nationale";
  const organe =
    reunion.type === "seance" ? `Séance publique — ${chambre}` : titreDeReunion(reunion);
  const premierPoint = pointsDeLOrdreDuJour(reunion.odjResume, reunion.odjComplet)[0];
  const jour = libelleDeSeance(reunion.dateDebut);
  const title = `${premierPoint ? `${organe} — ${premierPoint}` : organe} — ${jour}`;
  const description = [
    chambre,
    jour,
    (reunion.nbInterventions ?? 0) > 0 ? `${reunion.nbInterventions} prises de parole` : null,
    reunion.avisCommission.length > 0
      ? `${reunion.avisCommission.length} avis sur amendements`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const url = `/reunions/${encodeURIComponent(reunion.uid)}`;
  // Les séances d'une même journée au Sénat partagent un compte rendu : la page de la journée
  // est leur adresse canonique.
  const canonical = reunion.seanceCanonique
    ? `/reunions/${encodeURIComponent(reunion.seanceCanonique)}`
    : url;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url, type: "article" },
  };
};

const Page = async ({ params, searchParams }: Props) => {
  const { uid } = await params;
  const reunion = await loadReunion(uid);
  if (!reunion) notFound();
  return (
    <>
      <JsonLd data={[filArianeJsonLd(SITE_URL, filDeReunion(reunion.data))]} />
      <ReunionScreen uid={uid} params={await searchParams} initialData={reunion} />
    </>
  );
};

export default Page;
