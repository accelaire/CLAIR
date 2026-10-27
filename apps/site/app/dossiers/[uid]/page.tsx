import type { DossierDetail, EtapeParcoursDossier } from "@clair/data";
import {
  DossierFicheScreen,
  filArianeJsonLd,
  titreCourtLisible,
  titreDossier,
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

const CHAMBRES = { assemblee: "Assemblée nationale", senat: "Sénat" } as const;

/** Un seul appel par rendu pour les métadonnées et la page. */
const loadDossier = cache((uid: string) =>
  fetchResource<DossierDetail>(`/dossiers/${encodeURIComponent(uid)}`),
);

/** Le parcours décide de l'onglet par défaut : sans lui, la page s'ouvrirait sur un squelette. */
const loadParcours = async (uid: string) => {
  try {
    const reponse = await fetchResource<{ data: EtapeParcoursDossier[] }>(
      `/dossiers/${encodeURIComponent(uid)}/chronologie`,
    );
    return reponse?.data ?? null;
  } catch {
    return null;
  }
};

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { uid } = await params;
  const dossier = await loadDossier(uid);
  if (!dossier) return {};
  const title = titreCourtLisible(dossier) ?? titreDossier(dossier);
  const description = [
    `Dossier législatif : ${dossier.titre}`,
    dossier.procedureLibelle ? `Procédure : ${dossier.procedureLibelle}` : null,
    dossier.etat ? `État : ${dossier.etat}` : null,
    CHAMBRES[dossier.chambre],
    "Scrutins, amendements et débats sur CLAIR.vote.",
  ]
    .filter(Boolean)
    .join(". ");
  const url = `/dossiers/${dossier.uid}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
};

const Page = async ({ params, searchParams }: Props) => {
  const { uid } = await params;
  const [dossier, parcours] = await Promise.all([loadDossier(uid), loadParcours(uid)]);
  if (!dossier) notFound();
  return (
    <>
      <JsonLd
        data={[
          filArianeJsonLd(SITE_URL, [
            { nom: "Dossiers législatifs", chemin: "/dossiers" },
            {
              nom: titreCourtLisible(dossier) ?? titreDossier(dossier),
              chemin: `/dossiers/${dossier.uid}`,
            },
          ]),
        ]}
      />
      <DossierFicheScreen
        uid={uid}
        params={await searchParams}
        initialData={{ dossier, parcours }}
      />
    </>
  );
};

export default Page;
